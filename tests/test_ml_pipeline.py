"""
tests/test_ml_pipeline.py
──────────────────────────
Tests for the sensor ML pipeline.

Key test: test_auc_not_suspiciously_perfect — guards against label leakage
returning AUC ≥ 0.99. If someone re-introduces composite_risk_score,
this test catches it immediately.
"""
import json, joblib, numpy as np, pytest
from pathlib import Path

ROOT      = Path(__file__).resolve().parents[1]
SAVE_DIR  = ROOT / "ml" / "saved_models"
DATA_DIR  = ROOT / "data" / "sensors"


# ── Data loading ───────────────────────────────────────────────────────────────

class TestDataLoader:
    def test_load_returns_dataframe(self):
        from ml.data.sensor_data import load_sensors
        df = load_sensors()
        assert len(df) > 0

    def test_has_required_columns(self):
        from ml.data.sensor_data import load_sensors
        df = load_sensors()
        for col in ["timestamp","vibration","displacement","pore_pressure","strain"]:
            assert col in df.columns, f"Missing column: {col}"

    def test_no_nulls_in_numeric(self):
        from ml.data.sensor_data import load_sensors
        df = load_sensors()
        numeric = ["vibration","displacement","pore_pressure","strain","temperature"]
        for col in numeric:
            if col in df.columns:
                assert df[col].isna().sum() == 0, f"{col} has NaN"

    def test_values_non_negative(self):
        from ml.data.sensor_data import load_sensors
        df = load_sensors()
        for col in ["vibration","displacement","pore_pressure","strain","rainfall"]:
            if col in df.columns:
                assert (df[col] >= 0).all(), f"{col} has negative values"


# ── Feature engineering ────────────────────────────────────────────────────────

class TestFeatures:
    def test_build_features_shape(self):
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df = load_sensors()
        X, y = build_features(df)
        assert X.shape[0] == len(df)
        assert X.shape[1] > 50, f"Too few features: {X.shape[1]}"

    def test_no_nulls_in_features(self):
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df = load_sensors()
        X, _ = build_features(df)
        assert X.isna().sum().sum() == 0, "Feature matrix has NaN values"

    def test_composite_risk_score_absent(self):
        """
        CRITICAL: composite_risk_score must NOT appear in the feature matrix.
        It is algebraically identical to the old label formula, causing AUC=1.0.
        Its absence is a correctness requirement, not optional.
        """
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df = load_sensors()
        X, _ = build_features(df)
        assert "composite_risk_score" not in X.columns, (
            "composite_risk_score is in the feature matrix — this is a label leakage bug. "
            "Remove it from ml/data/features.py immediately."
        )

    def test_label_distribution_learnable(self):
        """All 3 classes need at least 10 samples for meaningful evaluation."""
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df = load_sensors()
        _, y = build_features(df)
        for cls in [0, 1, 2]:
            count = (y == cls).sum()
            assert count >= 10, (
                f"Class {cls} has only {count} samples — unlearnable. "
                "Check Isolation Forest contamination in ml/data/labels.py"
            )

    def test_interaction_features_present(self):
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df = load_sensors()
        X, _ = build_features(df)
        assert "vib_x_disp"       in X.columns
        assert "vib_strain_ratio" in X.columns


# ── Labels ─────────────────────────────────────────────────────────────────────

class TestLabels:
    def test_labels_reproducible(self):
        """Same input → same output (deterministic random seed)."""
        from ml.data.sensor_data import load_sensors
        from ml.data.labels      import make_anomaly_labels
        df = load_sensors()
        y1, _, _ = make_anomaly_labels(df)
        y2, _, _ = make_anomaly_labels(df)
        assert (y1 == y2).all()

    def test_scores_in_unit_interval(self):
        from ml.data.sensor_data import load_sensors
        from ml.data.labels      import make_anomaly_labels
        df = load_sensors()
        _, _, scores = make_anomaly_labels(df)
        assert scores.min() >= 0.0
        assert scores.max() <= 1.1   # slightly above 1 possible after temporal mult


# ── Trained models ─────────────────────────────────────────────────────────────

class TestSavedModels:
    @pytest.fixture(scope="class")
    def xgb(self):
        p = SAVE_DIR / "xgboost_model.pkl"
        if not p.exists():
            pytest.skip("xgboost_model.pkl not found — run: python -m ml.train")
        return joblib.load(p)

    @pytest.fixture(scope="class")
    def features(self):
        p = SAVE_DIR / "sensor_features.pkl"
        if not p.exists():
            pytest.skip("sensor_features.pkl not found — run: python -m ml.train")
        return joblib.load(p)

    def test_model_loads(self, xgb):
        assert xgb is not None

    def test_model_predicts(self, xgb, features):
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df   = load_sensors()
        X, _ = build_features(df)
        for c in features:
            if c not in X.columns: X[c] = 0.0
        X = X[[c for c in features if c in X.columns]]
        preds = xgb.predict(X[:10])
        assert len(preds) == 10
        assert set(preds).issubset({0, 1, 2})

    def test_probabilities_sum_to_one(self, xgb, features):
        from ml.data.sensor_data import load_sensors
        from ml.data.features    import build_features
        df   = load_sensors()
        X, _ = build_features(df)
        for c in features:
            if c not in X.columns: X[c] = 0.0
        X = X[[c for c in features if c in X.columns]]
        proba = xgb.predict_proba(X[:5])
        assert np.allclose(proba.sum(axis=1), 1.0, atol=1e-5)

    def test_auc_not_suspiciously_perfect(self):
        """
        AUC ≥ 0.99 on 500 synthetic rows = label leakage.
        This test catches regressions where composite_risk_score is re-introduced.
        Expected honest range: 0.65–0.90.
        """
        p = SAVE_DIR / "xgboost_meta.json"
        if not p.exists():
            pytest.skip("xgboost_meta.json not found")
        meta = json.loads(p.read_text())
        auc  = meta.get("test_auc", 0)
        assert auc < 0.99, (
            f"XGBoost AUC={auc:.4f} ≥ 0.99 — possible label leakage. "
            "Check that composite_risk_score is not in the feature matrix."
        )
        assert auc > 0.50, f"AUC={auc:.4f} is below chance — something is wrong."

    def test_meta_has_required_fields(self):
        p = SAVE_DIR / "xgboost_meta.json"
        if not p.exists():
            pytest.skip("xgboost_meta.json not found")
        meta = json.loads(p.read_text())
        for field in ["model","test_auc","test_f1_macro","n_features","label_source"]:
            assert field in meta, f"Missing field in xgboost_meta.json: {field}"
