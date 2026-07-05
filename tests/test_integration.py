"""
tests/test_integration.py  — End-to-end integration tests for Rockfall-AI.

These are NOT unit tests. They test the full request lifecycle:
  - Real model loading (not mocked)
  - Real image inference through the segmentation model
  - Real sensor inference through XGBoost
  - Fusion logic with actual model outputs
  - WebSocket liveness and message shape

Run separately from unit tests (require trained weights):
    PYTHONPATH=. pytest tests/test_integration.py -v

Segmentation tests auto-skip when unet_rockfall_real.pt is absent
(they will pass once train_e_drive.py completes).
"""
from __future__ import annotations
import io, json
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image as PILImage

from backend.main import app

client = TestClient(app)

ROOT         = Path(__file__).resolve().parents[1]
SEG_WEIGHTS  = ROOT / "ml/saved_models/segmentation_v2/unet_rockfall_real.pt"
XGB_WEIGHTS  = ROOT / "ml/saved_models/xgboost_model.pkl"

seg_trained  = pytest.mark.skipif(not SEG_WEIGHTS.exists(),
    reason="Segmentation weights absent — run train_e_drive.py first")
xgb_required = pytest.mark.skipif(not XGB_WEIGHTS.exists(),
    reason="XGBoost model absent")


# ─── helpers ──────────────────────────────────────────────────────────────────

def _png(w=256, h=256) -> io.BytesIO:
    arr = np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)
    buf = io.BytesIO()
    PILImage.fromarray(arr).save(buf, "PNG")
    buf.seek(0)
    return buf

def _rockfall_png(coverage=0.3, w=256, h=256) -> io.BytesIO:
    """Image where `coverage` fraction of pixels are RGB(0,110,255) — the rockfall class."""
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    n = int(w * h * coverage)
    idx = np.random.choice(w * h, n, replace=False)
    arr.reshape(-1, 3)[idx] = [0, 110, 255]
    buf = io.BytesIO()
    PILImage.fromarray(arr).save(buf, "PNG")
    buf.seek(0)
    return buf


# ─── health ───────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_lists_model_flags(self):
        d = client.get("/health").json()
        assert "models" in d, "health response missing 'models' key"
        assert isinstance(d["models"], dict)

    def test_health_reports_xgb_status_correctly(self):
        d = client.get("/health").json()
        expected = XGB_WEIGHTS.exists()
        actual   = d["models"].get("xgboost", False)
        assert actual == expected, (
            f"health.models.xgboost={actual} but file exists={expected}"
        )


# ─── sensor model ─────────────────────────────────────────────────────────────

class TestSensorIntegration:

    @xgb_required
    def test_low_readings_do_not_produce_high_risk(self):
        r = client.post("/predict/sensor", json={
            "vibration": 0.01, "displacement": 0.1,
            "pore_pressure": 0.05, "strain": 0.02,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["risk_level"] in ("LOW", "MEDIUM"), (
            f"Calm sensors produced {d['risk_level']} (score={d['risk_score']:.3f}) — "
            "check IsolationForest labelling or feature scaling"
        )

    @xgb_required
    def test_extreme_readings_produce_elevated_score(self):
        r = client.post("/predict/sensor", json={
            "vibration": 4.5, "displacement": 22.0,
            "pore_pressure": 6.5, "strain": 4.0,
        })
        assert r.status_code == 200
        assert r.json()["risk_score"] > 0.5, (
            "Extreme sensors scored ≤0.5 — model may not have learned from synthetic extremes"
        )

    @xgb_required
    def test_risk_score_bounded(self):
        r = client.post("/predict/sensor", json={
            "vibration": 1.0, "displacement": 5.0,
            "pore_pressure": 2.0, "strain": 1.0,
        })
        d = r.json()
        assert 0.0 <= d["risk_score"] <= 1.0, f"risk_score={d['risk_score']} out of [0,1]"

    @xgb_required
    def test_sensor_only_fusion_mode(self):
        r = client.post("/predict/final", data={
            "vibration": "1.2", "displacement": "4.5",
            "pore_pressure": "2.1", "strain": "1.0",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "sensor_only"
        assert d["confidence"] < 1.0, "confidence=1.0 sensor-only is overconfident"


# ─── segmentation model ───────────────────────────────────────────────────────

class TestSegmentationIntegration:

    @seg_trained
    def test_image_endpoint_200(self):
        r = client.post("/predict/image",
                        files={"file": ("t.png", _png(), "image/png")})
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    @seg_trained
    def test_blank_image_near_zero_coverage(self):
        blank = io.BytesIO()
        PILImage.fromarray(np.zeros((256, 256, 3), dtype=np.uint8)).save(blank, "PNG")
        blank.seek(0)
        r = client.post("/predict/image",
                        files={"file": ("blank.png", blank, "image/png")})
        assert r.status_code == 200
        cov = r.json()["coverage_pct"]
        assert cov < 5.0, (
            f"Blank image → {cov:.1f}% coverage. "
            "Model may be predicting all pixels as rockfall — check weights or threshold."
        )

    @seg_trained
    def test_high_rockfall_image_nonzero_coverage(self):
        r = client.post("/predict/image",
                        files={"file": ("rf.png", _rockfall_png(0.4), "image/png")})
        assert r.status_code == 200
        assert r.json()["coverage_pct"] > 0.0, (
            "Trained model returned 0% on an image filled with RGB(0,110,255). "
            "Check colour normalisation — the rockfall signal may be getting washed out."
        )

    @seg_trained
    def test_overlay_b64_is_valid_png(self):
        import base64
        r = client.post("/predict/image",
                        files={"file": ("t.png", _png(), "image/png")})
        assert r.status_code == 200
        b64 = r.json().get("overlay_b64")
        if b64:
            raw = base64.b64decode(b64)
            img = PILImage.open(io.BytesIO(raw))
            assert img.size[0] > 0

    @seg_trained
    def test_coverage_and_risk_score_correlated(self):
        lo = client.post("/predict/image",
                         files={"file": ("lo.png", _rockfall_png(0.02), "image/png")})
        hi = client.post("/predict/image",
                         files={"file": ("hi.png", _rockfall_png(0.65), "image/png")})
        assert lo.status_code == hi.status_code == 200
        lo_score = lo.json()["risk_score"]
        hi_score = hi.json()["risk_score"]
        assert lo_score <= hi_score, (
            f"Higher coverage produced lower risk score ({lo_score:.3f} vs {hi_score:.3f}). "
            "Check coverage→risk_score formula in model_registry.py"
        )


# ─── fusion ───────────────────────────────────────────────────────────────────

class TestFusionIntegration:

    @seg_trained
    @xgb_required
    def test_fused_mode_returns_explainability(self):
        r = client.post("/predict/final",
                        data={"vibration": "1.0", "displacement": "3.0",
                              "pore_pressure": "1.5", "strain": "0.8"},
                        files={"file": ("img.png", _png(), "image/png")})
        assert r.status_code == 200
        d = r.json()
        exp = d.get("explainability", {})
        for key in ("sensor_score", "image_score", "sensor_weight", "image_weight", "divergence"):
            assert key in exp, f"explainability missing '{key}'"

    @seg_trained
    @xgb_required
    def test_safety_bias_on_divergence(self):
        """
        When image says CRITICAL but sensors are calm, the fused score
        should be conservatively elevated, not suppressed to LOW.
        """
        r = client.post("/predict/final",
                        data={"vibration": "0.05", "displacement": "0.1",
                              "pore_pressure": "0.05", "strain": "0.02"},
                        files={"file": ("rf.png", _rockfall_png(0.80), "image/png")})
        assert r.status_code == 200
        d = r.json()
        div = d["explainability"]["divergence"]
        if div > 0.30:
            assert d["final_risk_score"] >= 0.25, (
                f"Safety bias failed: divergence={div:.2f} but fused score={d['final_risk_score']:.3f}. "
                "Check bias logic in model_registry.py"
            )


# ─── websocket ────────────────────────────────────────────────────────────────

class TestWebSocketIntegration:

    def test_ws_sends_valid_schema(self):
        with client.websocket_connect("/ws/sensor-stream") as ws:
            for _ in range(3):
                raw = ws.receive_text()
                d   = json.loads(raw)
                for field in ("vibration", "risk_score", "risk_level", "alert", "timestamp"):
                    assert field in d, f"WS message missing '{field}': {list(d.keys())}"
                assert 0.0 <= d["risk_score"] <= 1.0
                assert d["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")

    def test_ws_risk_level_consistent_with_score(self):
        """risk_level must be consistent with the numerical risk_score."""
        with client.websocket_connect("/ws/sensor-stream") as ws:
            for _ in range(5):
                d = json.loads(ws.receive_text())
                s, l = d["risk_score"], d["risk_level"]
                if   s < 0.40: assert l in ("LOW", "MEDIUM"),   f"score={s:.2f} but level={l}"
                elif s < 0.65: assert l in ("MEDIUM", "HIGH"),  f"score={s:.2f} but level={l}"
                elif s < 0.85: assert l in ("HIGH", "CRITICAL"),f"score={s:.2f} but level={l}"
