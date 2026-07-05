"""
ml/data/sensor_data.py
────────────────────────
Load real sensor CSVs or generate synthetic data for development.

Real data format expected (5 CSV files):
  data/sensors/vibrations.csv
  data/sensors/displacement.csv
  data/sensors/pore_pressure.csv
  data/sensors/strain.csv
  data/sensors/geoThermal_DS1.csv

Each CSV must have columns: timestamp, <sensor_value>
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

log  = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[2]

SENSOR_FILES = {
    "vibration":    "vibrations.csv",
    "displacement": "displacement.csv",
    "pore_pressure":"pore_pressure.csv",
    "strain":       "strain.csv",
    "temperature":  "geoThermal_DS1.csv",
}
SENSORS_DIR = ROOT / "data" / "sensors"


def _synthetic(n: int = 500, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic hourly sensor data for development/testing."""
    rng = np.random.default_rng(seed)
    ts  = pd.date_range("2024-01-01", periods=n, freq="h")

    # Base signal + trend + noise + occasional spikes
    def channel(base, scale, spike_p=0.05):
        v = base + rng.normal(0, scale, n)
        spikes = rng.random(n) < spike_p
        v[spikes] += rng.uniform(2*scale, 6*scale, spikes.sum())
        return np.maximum(0, v)

    df = pd.DataFrame({
        "timestamp":    ts,
        "vibration":    channel(0.3, 0.15, 0.04),
        "displacement": channel(2.0, 0.8,  0.03),
        "pore_pressure":channel(0.8, 0.3,  0.02),
        "strain":       channel(0.5, 0.2,  0.03),
        "temperature":  channel(28.0, 4.0, 0.01),
        "rainfall":     np.maximum(0, rng.exponential(3, n)),
    })
    return df


def load_sensors() -> pd.DataFrame:
    """
    Load sensor data.
    Returns a merged DataFrame with columns:
        timestamp, vibration, displacement, pore_pressure, strain, temperature, rainfall

    Falls back to synthetic data if CSVs not found.
    """
    if not SENSORS_DIR.exists():
        log.warning("data/sensors/ not found — using synthetic data")
        return _synthetic()

    found = {k: SENSORS_DIR / v for k, v in SENSOR_FILES.items() if (SENSORS_DIR / v).exists()}
    if len(found) < 2:
        log.warning(f"Only {len(found)} sensor files found — using synthetic data")
        return _synthetic()

    dfs = []
    for sensor, path in found.items():
        try:
            raw = pd.read_csv(path)
            # Normalise: find timestamp col and value col
            ts_col  = next((c for c in raw.columns if "time" in c.lower() or "date" in c.lower()), raw.columns[0])
            val_col = next((c for c in raw.columns if c != ts_col), None)
            if val_col is None:
                continue
            df_s = pd.DataFrame({"timestamp": pd.to_datetime(raw[ts_col]), sensor: raw[val_col].values})
            dfs.append(df_s)
        except Exception as e:
            log.warning(f"Could not load {path.name}: {e}")

    if not dfs:
        return _synthetic()

    merged = dfs[0]
    for df_s in dfs[1:]:
        merged = merged.merge(df_s, on="timestamp", how="outer")
    merged = merged.sort_values("timestamp").reset_index(drop=True).fillna(0)

    # Add missing columns
    for col in ["vibration","displacement","pore_pressure","strain","temperature","rainfall"]:
        if col not in merged.columns:
            merged[col] = 0.0

    log.info(f"Loaded {len(merged)} sensor readings from {len(dfs)} files")
    return merged
