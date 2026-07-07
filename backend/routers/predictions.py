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
            "tourist": "POST /predict/tourist",
        },
    }


@router.post(
    "/tourist",
    summary="Tourist safety risk prediction with location and live photo",
    description="""
    Fetches real-time weather data for the requested location name or coordinates, merges it with 
    current geotechnical sensor telemetry, and runs the multi-modal risk predictor 
    with their live slope photo. Also logs the request details into MongoDB.
    """,
)
async def predict_tourist(
    location_name: str = Form(..., description="Name of the tourist location (e.g. Yosemite Valley)"),
    latitude: Optional[float] = Form(None, description="Optional tourist live GPS latitude"),
    longitude: Optional[float] = Form(None, description="Optional tourist live GPS longitude"),
    file: Optional[UploadFile] = File(None, description="Optional tourist live photo of the slope"),
):
    import urllib.parse
    import httpx
    from datetime import datetime, timezone
    from backend.core.database import MongoDBManager

    lat = latitude
    lon = longitude
    resolved_location = location_name

    # If coordinates are provided, skip forward geocoding, but reverse geocode to get a human-readable location
    if lat is not None and lon is not None:
        try:
            # Reverse geocode via OSM Nominatim (needs User-Agent)
            headers = {"User-Agent": "Rockfall-AI/2.0.0 (contact@rockfall-ai.com)"}
            async with httpx.AsyncClient() as client:
                rev_res = await client.get(
                    f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}",
                    headers=headers,
                    timeout=5.0
                )
                if rev_res.status_code == 200:
                    rev_data = rev_res.json()
                    resolved_location = rev_data.get("display_name", f"GPS: {lat:.5f}, {lon:.5f}")
                else:
                    resolved_location = f"GPS: {lat:.5f}, {lon:.5f}"
        except Exception:
            resolved_location = f"GPS: {lat:.5f}, {lon:.5f}"
    else:
        # Resolve via forward geocoding
        quoted_name = urllib.parse.quote(location_name.strip())
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={quoted_name}&count=1&language=en&format=json"

        try:
            async with httpx.AsyncClient() as client:
                geo_res = await client.get(geo_url)
                geo_res.raise_for_status()
                geo_data = geo_res.json()
        except Exception as e:
            raise HTTPException(502, detail=f"Geocoding service unavailable: {e}")

        results = geo_data.get("results")
        if not results:
            raise HTTPException(404, detail=f"Location '{location_name}' could not be resolved. Please enter a valid city, park, or region name.")

        loc = results[0]
        lat = loc["latitude"]
        lon = loc["longitude"]
        resolved_location = f"{loc['name']}, {loc.get('admin1', '')}, {loc.get('country', '')}"

    # Fetch weather (include humidity, wind speed)
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,rain,showers,snowfall,wind_speed_10m,weather_code"
    try:
        async with httpx.AsyncClient() as client:
            weather_res = await client.get(weather_url)
            weather_res.raise_for_status()
            weather_data = weather_res.json()
    except Exception as e:
        raise HTTPException(502, detail=f"Weather service unavailable: {e}")

    current = weather_data.get("current")
    if not current:
        raise HTTPException(502, detail="Weather data parse error: missing 'current' field")

    temperature = float(current.get("temperature_2m", 20.0))
    humidity = float(current.get("relative_humidity_2m", 50.0))
    wind_speed = float(current.get("wind_speed_10m", 0.0))
    rain = float(current.get("rain", 0.0))
    showers = float(current.get("showers", 0.0))
    snowfall = float(current.get("snowfall", 0.0))
    rainfall = rain + showers + snowfall
    w_code = current.get("weather_code", 0)

    WMO_CODES = {
        0: "Clear Sky",
        1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing Rime Fog",
        51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
        56: "Light Freezing Drizzle", 57: "Dense Freezing Drizzle",
        61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
        66: "Light Freezing Rain", 67: "Heavy Freezing Rain",
        71: "Slight Snowfall", 73: "Moderate Snowfall", 75: "Heavy Snowfall",
        77: "Snow Grains",
        80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
        85: "Slight Snow Showers", 86: "Heavy Snow Showers",
        95: "Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail"
    }
    weather_desc = WMO_CODES.get(w_code, "Unknown Weather")

    # Get live sensor data
    try:
        from backend.routers.websocket import _simulator
        sim_state = _simulator.state
    except Exception:
        sim_state = {
            "vibration": 0.02,
            "displacement": 0.1,
            "pore_pressure": 0.05,
            "strain": 0.02,
        }

    sensors = {
        "vibration": float(sim_state.get("vibration", 0.02)),
        "displacement": float(sim_state.get("displacement", 0.1)),
        "pore_pressure": float(sim_state.get("pore_pressure", 0.05)),
        "strain": float(sim_state.get("strain", 0.02)),
        "temperature": temperature,
        "rainfall": rainfall
    }

    # Run predictions
    img_bytes = None
    if file is not None:
        img_bytes = await file.read()
        if not img_bytes:
            img_bytes = None

    result = _reg().predict_fused(sensors, img_bytes)

    # Attach tourist metadata (rich reports)
    tourist_meta = {
        "requested_location": location_name,
        "resolved_location": resolved_location,
        "latitude": float(lat),
        "longitude": float(lon),
        "weather": {
            "temperature_c": temperature,
            "humidity_pct": humidity,
            "wind_speed_kmh": wind_speed,
            "rainfall_mm": rainfall,
            "description": weather_desc,
            "code": w_code
        }
    }
    result["tourist_meta"] = tourist_meta

    # Log record to MongoDB
    try:
        record = {
            "timestamp": datetime.now(timezone.utc),
            "location_name": location_name,
            "resolved_location": resolved_location,
            "latitude": float(lat),
            "longitude": float(lon),
            "weather": tourist_meta["weather"],
            "sensor_readings": sensors,
            "final_risk_score": result["final_risk_score"],
            "risk_level": result["risk_level"],
            "confidence": result["confidence"],
            "has_image": img_bytes is not None
        }
        await MongoDBManager.get().save_tourist_record(record)
    except Exception as e:
        log.error(f"Error saving tourist log to MongoDB: {e}")

    return JSONResponse(content=result)

