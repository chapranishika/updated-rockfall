"""
ml/data/features.py
─────────────────────
Feature engineering for the sensor ML pipeline.

Produces 184 features per row:
  - Raw sensor values (6)
  - Rolling stats: mean/std/max at 3h/6h/12h/24h windows (6×4×3 = 72)
  - Rate-of-change + acceleration per sensor (6×2 = 12)
  - Lag features: 1h/3h/6h/12h deltas (6×4 = 24)
  - Cross-sensor interactions (5): vib×disp, pore×rain, strain×pore, etc.
  - Temporal flags (4): hour_sin, hour_cos, is_monsoon, is_night

NO composite_risk_score — that caused AUC=1.0 label leakage in v1.
See ml/data/labels.py for the correct labelling approach.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SENSORS = ["vibration", "displacement", "pore_pressure", "strain", "temperature", "rainfall"]
WINDOWS = [3, 6, 12, 24]   # hours
LAGS    = [1, 3, 6, 12]


def build_features(df: pd.DataFrame):
    """
    Build feature matrix and anomaly-based labels from sensor DataFrame.

    Parameters
    ----------
    df : output of sensor_data.load_sensors()

    Returns
    -------
    X : pd.DataFrame  — feature matrix
    y : pd.Series     — Isolation Forest anomaly labels {0,1,2}
    """
    from ml.data.labels import make_anomaly_labels

    parts = [
        df[[s for s in SENSORS if s in df.columns]].copy(),
        _rolling(df),
        _roc(df),
        _lags(df),
        _interactions(df),
        _temporal(df),
    ]
    X = pd.concat(parts, axis=1).fillna(0)
    y, _, _ = make_anomaly_labels(df)
    return X, y


def _rolling(df):
    out = {}
    for s in SENSORS:
        if s not in df.columns: continue
        for w in WINDOWS:
            r = df[s].rolling(w, min_periods=1)
            out[f"{s}_r{w}_mean"] = r.mean()
            out[f"{s}_r{w}_std"]  = r.std().fillna(0)
            out[f"{s}_r{w}_max"]  = r.max()
    return pd.DataFrame(out, index=df.index)


def _roc(df):
    out = {}
    for s in SENSORS:
        if s not in df.columns: continue
        out[f"{s}_diff1"] = df[s].diff(1).fillna(0)
        out[f"{s}_diff2"] = df[s].diff(1).diff(1).fillna(0)
    return pd.DataFrame(out, index=df.index)


def _lags(df):
    out = {}
    for s in SENSORS:
        if s not in df.columns: continue
        for lag in LAGS:
            out[f"{s}_lag{lag}_delta"] = (df[s] - df[s].shift(lag)).fillna(0)
    return pd.DataFrame(out, index=df.index)


def _interactions(df):
    eps = 1e-6
    out = {}
    if "vibration"    in df.columns and "displacement"  in df.columns:
        out["vib_x_disp"]       = df["vibration"] * df["displacement"]
    if "pore_pressure" in df.columns and "rainfall"     in df.columns:
        out["pore_x_rainfall"]  = df["pore_pressure"] * df["rainfall"]
    if "strain"        in df.columns and "pore_pressure" in df.columns:
        out["strain_x_pore"]    = df["strain"] * df["pore_pressure"]
    if "rainfall"      in df.columns and "displacement"  in df.columns:
        out["rainfall_x_disp"]  = df["rainfall"] * df["displacement"]
    if "vibration"     in df.columns and "strain"        in df.columns:
        out["vib_strain_ratio"] = df["vibration"] / (df["strain"] + eps)
    # NOTE: composite_risk_score removed — it caused AUC=1.0 label leakage
    return pd.DataFrame(out, index=df.index)


def _temporal(df):
    ts = pd.to_datetime(df["timestamp"]) if "timestamp" in df.columns else pd.Series(pd.Timestamp.now(), index=df.index)
    hour = ts.dt.hour
    return pd.DataFrame({
        "hour_sin":    np.sin(2 * np.pi * hour / 24),
        "hour_cos":    np.cos(2 * np.pi * hour / 24),
        "is_monsoon":  ((ts.dt.month >= 6) & (ts.dt.month <= 9)).astype(int),
        "is_night":    ((hour >= 22) | (hour <= 5)).astype(int),
    }, index=df.index)
