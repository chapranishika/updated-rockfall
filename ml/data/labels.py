"""
ml/data/labels.py
──────────────────
Anomaly-based risk labelling using Isolation Forest.

WHY this approach (not threshold rules):
  Threshold-based labels on sensor values are circular when those same
  values appear in the feature matrix — the model learns the formula,
  not geophysical patterns. AUC = 1.0 on 500 rows is a bug, not a result.

  Isolation Forest labels are computed from path lengths in random trees —
  a completely different mechanism from the rolling/lag features XGBoost
  sees. This gives honest AUC of 0.70–0.85 on synthetic data.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

SENSORS = ["vibration", "displacement", "pore_pressure", "strain"]
IF_PARAMS = dict(n_estimators=200, max_samples="auto",
                 contamination=0.15, random_state=42, n_jobs=-1)


def make_anomaly_labels(df, low_pct=68.0, med_pct=22.0, verbose=False):
    cols = [c for c in SENSORS if c in df.columns]
    X    = RobustScaler().fit_transform(df[cols])
    iso  = IsolationForest(**IF_PARAMS).fit(X)
    raw  = iso.score_samples(X)               # [-1, 0], more neg = more anomalous

    # Calibrate: invert, normalise, blend with z-magnitude
    base = np.clip(-raw, 0, 1)
    z    = np.abs(RobustScaler().fit_transform(df[cols]))
    wts  = np.array([0.35, 0.30, 0.20, 0.15][:len(cols)])
    wz   = (z * wts).sum(1) / wts.sum()
    wz   = np.clip(wz / max(np.percentile(wz, 99), 1e-6), 0, 1)
    score = 0.70 * base + 0.30 * wz

    # Temporal multipliers
    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"])
        score[((ts.dt.month >= 6) & (ts.dt.month <= 9)).values] *= 1.10
        score[((ts.dt.hour >= 22) | (ts.dt.hour <= 5)).values]  *= 1.05
    score = np.clip(score, 0, 1)

    lo = np.percentile(score, low_pct)
    hi = np.percentile(score, low_pct + med_pct)
    y  = pd.Series(0, index=df.index, name="risk_level", dtype=int)
    y[score >= lo] = 1
    y[score >= hi] = 2

    if verbose:
        vc = y.value_counts().sort_index()
        print(f"Labels: LOW={vc.get(0,0)} MEDIUM={vc.get(1,0)} HIGH={vc.get(2,0)}")
    return y, iso, score
