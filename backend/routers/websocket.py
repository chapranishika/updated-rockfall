"""
backend/routers/websocket.py
──────────────────────────────
WebSocket endpoint: real-time sensor simulation via Ornstein-Uhlenbeck process.

Broadcasts to all connected clients every 5 seconds.
Each message is a JSON object with current sensor readings + risk assessment.

Connect: ws://localhost:8000/ws/sensor-stream
"""
from __future__ import annotations

import asyncio, json, logging, math, random
from datetime import datetime, UTC
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log    = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# ── Ornstein-Uhlenbeck process parameters ─────────────────────────────────────
# Mean-reverting stochastic process — realistic for geophysical sensors
OU_PARAMS = {
    #           (mean,  theta, sigma, min, max)
    "vibration":    (0.30, 0.15, 0.04, 0.00, 2.50),
    "displacement": (2.00, 0.10, 0.25, 0.00,18.00),
    "pore_pressure":(0.80, 0.12, 0.08, 0.00, 5.00),
    "strain":       (0.50, 0.12, 0.06, 0.00, 3.00),
    "temperature":  (28.0, 0.05, 0.80,15.00,55.00),
    "rainfall":     (2.00, 0.30, 0.60, 0.00,80.00),
}

class SensorSimulator:
    """Vectorised O-U simulator. Thread-safe reads, lock-free (asyncio single-thread)."""
    def __init__(self):
        self.state = {k: p[0] for k, p in OU_PARAMS.items()}
        self._event_active = False
        self._event_ticks  = 0

    def step(self, dt: float = 5.0) -> dict:
        """Advance simulation by dt seconds and return new readings."""
        # 5% chance per tick to start a stress event
        if not self._event_active and random.random() < 0.05:
            self._event_active = True
            self._event_ticks  = random.randint(3, 12)

        if self._event_active:
            self._event_ticks -= 1
            if self._event_ticks <= 0:
                self._event_active = False

        event_mult = 3.5 if self._event_active else 1.0

        for key, (mu, theta, sigma, lo, hi) in OU_PARAMS.items():
            x   = self.state[key]
            dW  = random.gauss(0, math.sqrt(dt))
            mul = event_mult if key in ("vibration","displacement","pore_pressure") else 1.0
            dx  = theta * (mu * mul - x) * dt + sigma * mul * dW
            self.state[key] = max(lo, min(hi, x + dx))

        return dict(self.state)


# ── Global state ──────────────────────────────────────────────────────────────

_simulator   = SensorSimulator()
_connections: Set[WebSocket] = set()
_loop_task   = None


async def _broadcast_loop():
    global _simulator
    while True:
        await asyncio.sleep(5)
        if not _connections:
            continue
        readings = _simulator.step(5.0)

        # Quick risk estimate (no model needed for simulation)
        vib  = readings["vibration"]
        disp = readings["displacement"]
        pore = readings["pore_pressure"]
        score = min(1.0, (
            0.35 * min(vib  / 1.0, 1.0) +
            0.30 * min(disp / 8.0, 1.0) +
            0.20 * min(pore / 3.0, 1.0) +
            0.15 * min(readings["strain"] / 1.5, 1.0)
        ))
        level = ("CRITICAL" if score >= 0.80 else "HIGH" if score >= 0.65
                 else "MEDIUM" if score >= 0.40 else "LOW")

        msg = json.dumps({
            "timestamp":    datetime.now(UTC).isoformat(),
            **{k: round(v, 4) for k, v in readings.items()},
            "risk_score":   round(score, 4),
            "risk_level":   level,
            "alert":        level in ("HIGH","CRITICAL"),
            "event_active": _simulator._event_active,
        })

        dead = set()
        for ws in list(_connections):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        _connections -= dead


async def ensure_loop():
    global _loop_task
    if _loop_task is None or _loop_task.done():
        _loop_task = asyncio.create_task(_broadcast_loop())
        log.info("Sensor simulation loop started")


@router.websocket("/ws/sensor-stream")
async def sensor_stream(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    await ensure_loop()
    log.info(f"WebSocket client connected ({len(_connections)} total)")
    try:
        while True:
            # Keep alive — client can send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(ws)
        log.info(f"WebSocket client disconnected ({len(_connections)} remaining)")


@router.get("/ws/clients", tags=["websocket"])
async def ws_client_count():
    return {"connected_clients": len(_connections)}
