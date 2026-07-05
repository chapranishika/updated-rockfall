"""
backend/main.py
────────────────
Rockfall-AI FastAPI backend.

Models loaded ONCE at startup via ModelRegistry lifespan hook.
Run: uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
UTC = timezone.utc

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ── Lifespan: load all models at startup ──────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🪨 Rockfall-AI starting — loading models...")
    try:
        from backend.core.model_registry import ModelRegistry
        reg = ModelRegistry.get()
        log.info(f"✅ Models ready: {reg.ready}")
    except Exception as e:
        log.error(f"⚠️  Model load failed (app still starts): {e}")
    yield
    log.info("🛑 Shutting down")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Rockfall-AI API",
    description = (
        "Multi-modal geophysical risk prediction.\n\n"
        "Combines sensor time-series (XGBoost) with drone image segmentation "
        "(U-Net + ResNet34 trained on 585 real drone patches) into a "
        "calibrated, explainable risk score.\n\n"
        "**Primary segmentation model**: `POST /predict/image`\n"
        "Positive class: RGB(0,110,255) = rockfall debris (verified vs BinaryMasks)."
    ),
    version     = "2.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    t0       = time.time()
    response = await call_next(request)
    ms       = (time.time() - t0) * 1000
    response.headers["X-Response-Time"] = f"{ms:.1f}ms"
    return response


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc),
                 "timestamp": datetime.now(UTC).isoformat()},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

from backend.routers.predictions import router as pred_router
from backend.routers.websocket   import router as ws_router
app.include_router(pred_router)
app.include_router(ws_router)


# ── Root & health ─────────────────────────────────────────────────────────────

@app.get("/", tags=["meta"])
async def root():
    return {
        "service":   "Rockfall-AI",
        "version":   "2.0.0",
        "status":    "operational",
        "timestamp": datetime.now(UTC).isoformat(),
        "endpoints": {
            "predict_sensor": "POST /predict/sensor",
            "predict_image":  "POST /predict/image",
            "predict_final":  "POST /predict/final",
            "predict_demo":   "GET  /predict/demo",
            "model_info":     "GET  /predict/model-info",
            "docs":           "/docs",
        },
    }


@app.get("/health", tags=["meta"])
async def health():
    from backend.core.model_registry import ModelRegistry
    reg = ModelRegistry.get()
    return {
        "status":    "healthy",
        "models":    reg.ready,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@app.get("/health/live",  tags=["meta"])
async def liveness():
    return {"status": "ok"}


@app.get("/health/ready", tags=["meta"])
async def readiness():
    from backend.core.model_registry import ModelRegistry
    reg = ModelRegistry.get()
    if not any(reg.ready.values()):
        return JSONResponse(status_code=503, content={"status": "not ready", "models": reg.ready})
    return {"status": "ready", "models": reg.ready}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
