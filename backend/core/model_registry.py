"""
backend/core/model_registry.py
────────────────────────────────
Singleton model registry — loads all ML models ONCE at startup.
Zero per-request overhead.

Models managed:
  1. Sensor XGBoost   (ml/saved_models/xgboost_model.pkl)
  2. Segmentation     (ml/saved_models/segmentation_v2/unet_rockfall_real.pt)

Usage anywhere in the app:
    reg = ModelRegistry.get()
    result = reg.predict_fused(sensor_values, image_bytes)
"""
from __future__ import annotations

import base64, gc, io, json, logging, time
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image

log  = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[2]

MEAN         = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD          = np.array([0.229, 0.224, 0.225], dtype=np.float32)
ROCKFALL_RGB = (0, 110, 255)

SENSOR_W  = 0.55
IMAGE_W   = 0.45
RISK_LEVELS = {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}
RISK_COLORS = {
    "LOW":      "#3FB950", "MEDIUM": "#F0883E",
    "HIGH":     "#FF4545", "CRITICAL": "#FF1744",
}


# ── Lightweight 3-level U-Net (fallback if smp unavailable) ───────────────────

def _build_light_unet():
    import torch, torch.nn as nn
    class DC(nn.Module):
        def __init__(self,i,o):
            super().__init__()
            self.c = nn.Sequential(
                nn.Conv2d(i,o,3,padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
                nn.Conv2d(o,o,3,padding=1), nn.BatchNorm2d(o), nn.ReLU(inplace=True))
        def forward(self,x): return self.c(x)
    class UNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.e1=DC(3,32); self.e2=DC(32,64); self.e3=DC(64,128)
            self.pool=nn.MaxPool2d(2); self.b=DC(128,256)
            self.u3=nn.ConvTranspose2d(256,128,2,2); self.d3=DC(256,128)
            self.u2=nn.ConvTranspose2d(128,64,2,2);  self.d2=DC(128,64)
            self.u1=nn.ConvTranspose2d(64,32,2,2);   self.d1=DC(64,32)
            self.out=nn.Conv2d(32,1,1)
        def forward(self,x):
            e1=self.e1(x); e2=self.e2(self.pool(e1)); e3=self.e3(self.pool(e2))
            b=self.b(self.pool(e3))
            d=self.d3(torch.cat([self.u3(b),e3],1))
            d=self.d2(torch.cat([self.u2(d),e2],1))
            d=self.d1(torch.cat([self.u1(d),e1],1))
            return self.out(d)
    return UNet()


class ModelRegistry:
    """
    Singleton that loads all ML models once at application startup.

    Thread-safe for concurrent read access (PyTorch inference is GIL-free
    under torch.no_grad()). Models are never reloaded per request.
    """
    _instance: Optional["ModelRegistry"] = None

    def __init__(self):
        self._sensor_model    = None
        self._sensor_features = None
        self._seg_model       = None
        self._seg_size        = 256
        self._ready           = {"sensor": False, "segmentation": False}
        self._load_all()

    @classmethod
    def get(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        cls._instance = None

    @property
    def ready(self) -> Dict[str, bool]:
        return self._ready.copy()

    # ── Startup loading ───────────────────────────────────────────────────────

    def _load_all(self):
        t0 = time.time()
        self._load_sensor()
        self._load_segmentation()
        elapsed = time.time() - t0
        log.info(
            f"ModelRegistry ready in {elapsed:.2f}s | "
            f"sensor={self._ready['sensor']} | seg={self._ready['segmentation']}"
        )

    def _load_sensor(self):
        try:
            import joblib
            candidates = [
                ROOT / "ml/saved_models/xgboost_model.pkl",
                ROOT / "ml/saved_models/sensor_model.pkl",
            ]
            for path in candidates:
                if path.exists():
                    self._sensor_model = joblib.load(path)
                    feat_p = ROOT / "ml/saved_models/sensor_features.pkl"
                    if feat_p.exists():
                        self._sensor_features = joblib.load(feat_p)
                    self._ready["sensor"] = True
                    log.info(f"  Sensor model: {path.name}")
                    return
            log.warning("  No sensor model found — train with: python -m ml.train")
        except Exception as e:
            log.error(f"  Sensor load failed: {e}")

    def _load_segmentation(self):
        """
        Loads the PRIMARY U-Net model trained on real drone imagery.
        Falls back to lightweight UNet if smp not available.
        """
        import torch
        candidates = [
            ROOT / "ml/saved_models/segmentation_v2/unet_rockfall_real.pt",
            ROOT / "ml/saved_models/segmentation_v2/unet_rockfall.pt",
            ROOT / "ml/saved_models/segmentation/unet_rockfall.pt",
        ]
        meta_candidates = [
            ROOT / "ml/saved_models/segmentation_v2/unet_rockfall_real_meta.json",
            ROOT / "ml/saved_models/segmentation_v2/unet_rockfall_meta.json",
        ]

        wt_path = next((p for p in candidates if p.exists()), None)
        if wt_path is None:
            log.warning(
                "  No segmentation model found. "
                "Train with: python ml/segmentation_v2/train_e_drive.py"
            )
            return

        # Read size from meta
        for mp in meta_candidates:
            if mp.exists():
                self._seg_size = json.loads(mp.read_text()).get("img_size", 256)
                break

        device = torch.device("cpu")
        try:
            import segmentation_models_pytorch as smp
            model = smp.Unet("resnet34", encoder_weights=None,
                             in_channels=3, classes=1, activation=None)
            model.load_state_dict(torch.load(wt_path, map_location=device))
            log.info(f"  Segmentation: smp.Unet resnet34  ({wt_path.name}  size={self._seg_size})")
        except Exception:
            try:
                model = _build_light_unet()
                model.load_state_dict(torch.load(wt_path, map_location=device))
                log.info(f"  Segmentation: LightUNet fallback ({wt_path.name}  size={self._seg_size})")
            except Exception as e2:
                log.error(f"  Segmentation load failed: {e2}")
                return

        model.eval()
        self._seg_model = model
        self._ready["segmentation"] = True

    # ── Sensor prediction ──────────────────────────────────────────────────────

    def predict_sensor(self, sensor_values: Dict[str, float]) -> Dict[str, Any]:
        if not self._ready["sensor"]:
            return {"error": "Sensor model not loaded", "risk_score": 0.0, "risk_level": "UNKNOWN", "alert": False}
        try:
            import pandas as pd
            COLS = ["vibration","strain","pore_pressure","displacement","temperature","rainfall"]
            row  = {"timestamp": pd.Timestamp.now()}
            for c in COLS: row[c] = float(sensor_values.get(c, 0.0))
            df   = pd.DataFrame([row])

            # Feature engineering — uses Isolation Forest labels internally
            # but we only need X (features), not y (labels) for inference
            try:
                from ml.data.features import build_features
                X, _ = build_features(df)
            except Exception:
                X = df.drop(columns=["timestamp"], errors="ignore")

            if self._sensor_features is not None:
                for c in self._sensor_features:
                    if c not in X.columns: X[c] = 0.0
                X = X[[c for c in self._sensor_features if c in X.columns]]

            proba     = self._sensor_model.predict_proba(X)[0]
            risk_code = int(self._sensor_model.predict(X)[0])
            s_score   = (proba[1]*0.5 + proba[2]*1.0) if len(proba)>2 else float(proba[-1])

            return {
                "risk_score":    round(float(s_score), 4),
                "risk_code":     risk_code,
                "risk_level":    RISK_LEVELS.get(risk_code, "UNKNOWN"),
                "probabilities": {RISK_LEVELS.get(i,"?"): round(float(p),4) for i,p in enumerate(proba)},
                "alert":         risk_code >= 2,
            }
        except Exception as e:
            log.error(f"Sensor prediction error: {e}")
            return {"error": str(e), "risk_score": 0.0, "risk_level": "UNKNOWN", "alert": False}

    # ── Image prediction ───────────────────────────────────────────────────────

    def predict_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        U-Net inference on uploaded image.

        Returns:
          risk_score    — [0,1] derived from rockfall coverage
          coverage_pct  — % pixels classified as rockfall
          overlay_b64   — base64 PNG with red overlay on rockfall zones
          mask_b64      — base64 PNG greyscale binary mask
        """
        if not self._ready["segmentation"]:
            return {
                "error": "Segmentation model not loaded. Run: python ml/segmentation_v2/train_e_drive.py",
                "risk_score": 0.0, "coverage_pct": 0.0, "alert": False,
            }
        try:
            import torch
            size     = self._seg_size
            img      = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_disp = np.array(img.resize((512, 512)))

            # Preprocess
            img_s = np.array(img.resize((size, size)), dtype=np.float32)
            img_n = (img_s / 255.0 - MEAN) / STD
            img_t = torch.from_numpy(img_n.transpose(2,0,1)).unsqueeze(0)

            # Inference (no_grad — thread-safe read)
            with torch.no_grad():
                prob_sm = torch.sigmoid(self._seg_model(img_t)).squeeze().numpy()
            gc.collect()

            # Upsample to display size
            prob_up  = np.array(Image.fromarray(prob_sm).resize((512,512), Image.BILINEAR))
            pred_bin = prob_up > 0.45
            coverage = float(pred_bin.mean() * 100)

            # Sigmoid risk centred at 30% coverage (dataset mean)
            risk  = float(1 / (1 + np.exp(-8 * (coverage/100 - 0.30))))
            level = "HIGH" if risk>=0.70 else "MEDIUM" if risk>=0.40 else "LOW"

            # Overlay
            overlay = img_disp.copy().astype(float)
            overlay[pred_bin] = overlay[pred_bin]*0.55 + np.array([255,60,60])*0.45
            overlay_img = Image.fromarray(overlay.clip(0,255).astype(np.uint8))
            mask_img    = Image.fromarray((pred_bin*255).astype(np.uint8))

            def b64(img_pil):
                buf=io.BytesIO(); img_pil.save(buf,"PNG")
                return base64.b64encode(buf.getvalue()).decode()

            return {
                "risk_score":   round(risk,4),
                "risk_level":   level,
                "alert":        risk >= 0.65,
                "coverage_pct": round(coverage,2),
                "mean_prob":    round(float(prob_sm.mean()),4),
                "overlay_b64":  b64(overlay_img),
                "mask_b64":     b64(mask_img),
                "model":        "U-Net+ResNet34 (real drone data, 585 patches)",
            }
        except Exception as e:
            log.error(f"Image prediction error: {e}")
            return {"error": str(e), "risk_score": 0.0, "coverage_pct": 0.0, "alert": False}

    # ── Fusion prediction ──────────────────────────────────────────────────────

    def predict_fused(
        self,
        sensor_values: Optional[Dict[str,float]] = None,
        image_bytes:   Optional[bytes]           = None,
    ) -> Dict[str, Any]:
        """
        Fused sensor + image prediction.

        Fusion weights: 55% sensor, 45% image.
        Safety bias: when signals diverge >0.30, bias toward more dangerous score.
        Confidence: 1 - 0.45 × |sensor - image|
        """
        s_res   = self.predict_sensor(sensor_values) if sensor_values else None
        i_res   = self.predict_image(image_bytes)     if image_bytes   else None

        s_score = s_res.get("risk_score",0.0) if s_res and not s_res.get("error") else 0.0
        i_score = i_res.get("risk_score",0.0) if i_res and not i_res.get("error") else 0.0

        if s_res and i_res:
            mode  = "sensor+image"
            base  = SENSOR_W*s_score + IMAGE_W*i_score
            delta = abs(s_score - i_score)
            if delta > 0.30:
                base = 0.65*max(s_score,i_score) + 0.35*base
            final = float(np.clip(base,0,1))
            conf  = round(max(0.0, 1.0-0.45*delta), 3)
        elif s_res and not s_res.get("error"):
            mode="sensor_only"; final=s_score; conf=0.85
        elif i_res and not i_res.get("error"):
            mode="image_only";  final=i_score; conf=0.75
        else:
            mode="no_input"; final=0.0; conf=1.0

        level = ("CRITICAL" if final>=0.80 else "HIGH" if final>=0.65
                 else "MEDIUM" if final>=0.40 else "LOW")

        recs = {
            "CRITICAL": "Evacuate immediately. Alert NDRF. Close access roads.",
            "HIGH":     "Issue public alert. Increase monitoring. Prepare evacuation.",
            "MEDIUM":   "Heightened monitoring. Notify local authorities.",
            "LOW":      "Continue routine monitoring. No immediate action required.",
        }

        image_result_clean = None
        if i_res:
            image_result_clean = {k:v for k,v in i_res.items()
                                  if k not in ("overlay_b64","mask_b64")}

        return {
            "final_risk_score":  round(final,4),
            "risk_level":        level,
            "risk_color":        RISK_COLORS[level],
            "alert":             level in ("HIGH","CRITICAL"),
            "confidence":        conf,
            "recommendation":    recs[level],
            "mode":              mode,
            "sensor_result":     s_res,
            "image_result":      image_result_clean,
            "image_overlay_b64": i_res.get("overlay_b64") if i_res else None,
            "explainability": {
                "sensor_score":   round(s_score,4),
                "image_score":    round(i_score,4),
                "sensor_weight":  SENSOR_W,
                "image_weight":   IMAGE_W,
                "divergence":     round(abs(s_score-i_score),4),
                "factors": {
                    "Sensor":   f"Score {s_score:.2f}  level={s_res.get('risk_level','—') if s_res else 'not provided'}",
                    "Imagery":  (f"Coverage {i_res.get('coverage_pct',0):.1f}%  score {i_score:.2f}"
                                 if i_res else "not provided"),
                },
                **({"sensor_probabilities": s_res["probabilities"]}
                   if s_res and "probabilities" in s_res else {}),
            },
        }
