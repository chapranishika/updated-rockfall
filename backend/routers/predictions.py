"""
backend/routers/predictions.py
────────────────────────────────
Prediction endpoints. All models loaded once via ModelRegistry at startup.

POST /predict/sensor  — sensor XGBoost
POST /predict/image   — U-Net segmentation + overlay
POST /predict/final   — fused sensor + image
GET  /predict/demo    — demo with simulated inputs
GET  /predict/model-info — registry status
"""
from __future__ import annotations

import logging, random
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["predictions"])
ROOT   = Path(__file__).resolve().parents[2]


def _reg():
    from backend.core.model_registry import ModelRegistry
    return ModelRegistry.get()


# ── Schemas ────────────────────────────────────────────────────────────────────

class SensorInput(BaseModel):
    vibration:     float = Field(0.0, ge=0, description="Ground vibration (g)")
    strain:        float = Field(0.0, ge=0, description="Rock strain (με)")
    pore_pressure: float = Field(0.0, ge=0, description="Pore water pressure (kPa)")
    displacement:  float = Field(0.0, ge=0, description="Slope displacement (mm)")
    temperature:   float = Field(20.0,      description="Geothermal temp (°C)")
    rainfall:      float = Field(0.0, ge=0, description="Rainfall (mm)")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/sensor",
    summary="Sensor-based risk score",
    description="""
Run XGBoost sensor model on geophysical readings.

**Input**: JSON with any sensor values (zero-fills missing ones).

**Output**: `risk_score` [0–1], `risk_level`, per-class `probabilities`.

```json
{
  "vibration": 0.82,
  "displacement": 6.1,
  "pore_pressure": 2.4
}
```
    """,
)
async def predict_sensor(body: SensorInput):
    result = _reg().predict_sensor(body.model_dump())
    if result.get("risk_level") == "UNKNOWN":
        raise HTTPException(503, detail=result.get("error","Sensor model not ready"))
    return JSONResponse(content=result)


@router.post(
    "/image",
    summary="Image segmentation + risk score",
    description="""
Upload a drone or satellite image and receive:

- **Binary rockfall mask** (base64 PNG)
- **Red overlay visualisation** (base64 PNG)
- **coverage_pct** — percentage of image classified as rockfall
- **risk_score** — derived from coverage

**Model**: U-Net + ResNet34 trained on 585 real drone patches.
**Positive class**: RGB (0, 110, 255) = rockfall debris (verified vs BinaryMasks).

Returns `overlay_b64` and `mask_b64` as base64-encoded PNG strings,
ready to display directly: `<img src="data:image/png;base64,..."/>`
    """,
)
async def predict_image(
    file: UploadFile = File(..., description="Drone/satellite image (PNG, JPEG, TIFF)"),
):
    ct = file.content_type or ""
    if not any(ct.startswith(t) for t in ("image/", "application/octet-stream", "")):
        raise HTTPException(400, detail=f"Expected image file, got: {ct}")

    data = await file.read()
    if not data:
        raise HTTPException(400, detail="Empty file")
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(413, detail="File too large (max 100MB)")

    result = _reg().predict_image(data)
    if "error" in result:
        raise HTTPException(503, detail=result["error"])
    return JSONResponse(content=result)


@router.post(
    "/final",
    summary="Fused sensor + image prediction",
    description="""
Multi-modal fusion of sensor readings and drone imagery.

**Fusion formula**:
```
final = 0.55 × sensor_score + 0.45 × image_score
```
Safety bias: when signals diverge >0.30, bias toward the more dangerous score.

Image is **optional** — without it, falls back to sensor-only mode.

Submit as `multipart/form-data` with sensor fields + optional `file`.
    """,
)
async def predict_final(
    vibration:     float = Form(0.0),
    strain:        float = Form(0.0),
    pore_pressure: float = Form(0.0),
    displacement:  float = Form(0.0),
    temperature:   float = Form(20.0),
    rainfall:      float = Form(0.0),
    file: Optional[UploadFile] = File(None),
):
    sensors = {
        "vibration": vibration, "strain": strain,
        "pore_pressure": pore_pressure, "displacement": displacement,
        "temperature": temperature, "rainfall": rainfall,
    }
    img_bytes = None
    if file is not None:
        img_bytes = await file.read()
        if not img_bytes:
            img_bytes = None

    result = _reg().predict_fused(sensors, img_bytes)
    return JSONResponse(content=result)


@router.get(
    "/demo",
    summary="Demo prediction (no input required)",
    description="Runs fusion with simulated sensor values and a sample mask image. Useful for dashboard testing.",
)
async def predict_demo():
    sensors = {
        "vibration":    round(random.uniform(0.2, 1.8), 3),
        "strain":       round(random.uniform(0.3, 2.0), 3),
        "pore_pressure":round(random.uniform(0.5, 3.5), 3),
        "displacement": round(random.uniform(1.0, 14.0), 3),
        "temperature":  round(random.uniform(18.0, 48.0), 1),
        "rainfall":     round(random.uniform(0.0, 65.0), 1),
    }
    img_bytes = None
    mask_dir  = ROOT / "data/drone/masks"
    masks     = sorted(mask_dir.glob("*.png")) if mask_dir.exists() else []
    if masks:
        img_bytes = masks[random.randint(0, min(49, len(masks)-1))].read_bytes()

    result = _reg().predict_fused(sensors, img_bytes)
    result["demo"] = True
    result["demo_sensor_inputs"] = sensors
    return JSONResponse(content=result)


@router.get(
    "/model-info",
    summary="Model registry status",
)
async def model_info():
    import json as jsonlib
    reg  = _reg()
    meta = {}
    for mp in [
        ROOT / "ml/saved_models/segmentation_v2/unet_rockfall_real_meta.json",
        ROOT / "ml/saved_models/segmentation_v2/unet_meta.json",
    ]:
        if mp.exists():
            raw  = jsonlib.loads(mp.read_text())
            meta = {k: v for k, v in raw.items() if k not in ("history", "note")}
            break

    return {
        "models_loaded":      reg.ready,
        "segmentation_meta":  meta,
        "primary_model_note": "U-Net+ResNet34 trained on 585 real RGBA drone patches",
        "label_verified":     "RGB(0,110,255)=rockfall — 100% overlap vs BinaryMasks",
        "endpoints": {
            "sensor":  "POST /predict/sensor",
            "image":   "POST /predict/image",
            "fusion":  "POST /predict/final",
            "demo":    "GET  /predict/demo",
        },
    }
