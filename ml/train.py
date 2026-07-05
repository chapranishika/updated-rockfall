#!/usr/bin/env python3
"""
ml/train.py — Train XGBoost sensor risk classifier.

Usage:
    python -m ml.train
    python -m ml.train --no-cv   # faster, for development
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model    import LogisticRegression
from sklearn.metrics         import f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing   import StandardScaler
from xgboost                 import XGBClassifier

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from ml.data.sensor_data import load_sensors
from ml.data.features    import build_features

SAVE_DIR = ROOT / "saved_models"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


def main(no_cv: bool = False):
    print("\n=== Rockfall-AI: Sensor Model Training ===")

    df = load_sensors()
    print(f"Loaded: {len(df)} rows")

    X, y = build_features(df)
    print(f"Features: {X.shape}  Labels: {y.value_counts().sort_index().to_dict()}")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Save feature names for inference
    joblib.dump(list(X.columns), SAVE_DIR / "sensor_features.pkl")

    # ── Baseline: Logistic Regression ─────────────────────────────────────────
    sc  = StandardScaler()
    lr  = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
    lr.fit(sc.fit_transform(X_tr), y_tr)
    lr_pred  = lr.predict(sc.transform(X_te))
    lr_proba = lr.predict_proba(sc.transform(X_te))
    lr_auc   = roc_auc_score(y_te, lr_proba, multi_class="ovr", average="macro")
    lr_f1    = f1_score(y_te, lr_pred, average="macro", zero_division=0)
    print(f"Logistic Regression  AUC={lr_auc:.4f}  F1={lr_f1:.4f}")

    # ── XGBoost ────────────────────────────────────────────────────────────────
    counts   = y_tr.value_counts().sort_index()
    majority = counts.max()
    w        = {c: majority / counts[c] for c in counts.index}
    sample_w = y_tr.map(w).values

    xgb = XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        use_label_encoder=False, eval_metric="mlogloss",
        random_state=42, verbosity=0,
    )

    if not no_cv:
        cv   = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        aucs = []
        for fold, (tr_i, va_i) in enumerate(cv.split(X_tr, y_tr), 1):
            xf = XGBClassifier(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                use_label_encoder=False, eval_metric="mlogloss",
                random_state=42, verbosity=0,
            )
            w_fold = y_tr.iloc[tr_i].map(w).values
            xf.fit(X_tr.iloc[tr_i], y_tr.iloc[tr_i], sample_weight=w_fold)
            p = xf.predict_proba(X_tr.iloc[va_i])
            aucs.append(roc_auc_score(y_tr.iloc[va_i], p, multi_class="ovr", average="macro"))
        print(f"XGBoost CV  AUC={np.mean(aucs):.4f} ± {np.std(aucs):.4f}")

    xgb.fit(X_tr, y_tr, sample_weight=sample_w)
    xgb_pred  = xgb.predict(X_te)
    xgb_proba = xgb.predict_proba(X_te)
    xgb_auc   = roc_auc_score(y_te, xgb_proba, multi_class="ovr", average="macro")
    xgb_f1    = f1_score(y_te, xgb_pred, average="macro", zero_division=0)
    print(f"XGBoost test  AUC={xgb_auc:.4f}  F1={xgb_f1:.4f}")

    if xgb_auc >= 0.99:
        print("⚠️  WARNING: AUC ≥ 0.99 on synthetic data — check for leakage")

    # ── Save ───────────────────────────────────────────────────────────────────
    joblib.dump(xgb, SAVE_DIR / "xgboost_model.pkl")
    joblib.dump(lr,  SAVE_DIR / "logistic_regression.pkl")
    joblib.dump(sc,  SAVE_DIR / "sensor_scaler.pkl")

    meta = {
        "model":          "XGBoost",
        "n_features":     X.shape[1],
        "n_train":        len(X_tr),
        "n_test":         len(X_te),
        "label_source":   "IsolationForest anomaly scores (not real events)",
        "test_auc":       round(xgb_auc, 4),
        "test_f1_macro":  round(xgb_f1,  4),
        "baseline_auc":   round(lr_auc,  4),
        "trained_at":     str(pd.Timestamp.now())[:19],
        "note":           "Labels are IF anomaly scores. Replace with real event data for production.",
    }
    (SAVE_DIR / "xgboost_meta.json").write_text(json.dumps(meta, indent=2))
    print(f"\n✅  Saved to {SAVE_DIR}")
    print(json.dumps({k:v for k,v in meta.items() if k != "note"}, indent=2))
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-cv", action="store_true")
    args = ap.parse_args()
    main(no_cv=args.no_cv)
