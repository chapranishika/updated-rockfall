"""
tests/test_api.py
──────────────────
FastAPI endpoint tests for Rockfall-AI backend.
"""
import io, json
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class TestHealth:
    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        d = r.json()
        assert d["service"] == "Rockfall-AI"
        assert "endpoints" in d

    def test_health(self):
        r = client.get("/health")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "healthy"
        assert "models" in d

    def test_liveness(self):
        r = client.get("/health/live")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_readiness_returns_valid_status(self):
        r = client.get("/health/ready")
        assert r.status_code in (200, 503)
        d = r.json()
        assert "models" in d

    def test_ws_client_count(self):
        r = client.get("/ws/clients")
        assert r.status_code == 200
        assert "connected_clients" in r.json()


class TestSensorEndpoint:
    def test_predict_sensor_success(self):
        r = client.post("/predict/sensor", json={
            "vibration": 0.8, "displacement": 5.2,
            "pore_pressure": 1.8, "strain": 0.9,
        })
        # 200 if sensor model loaded, 503 if not (both are correct)
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            d = r.json()
            assert "risk_score"  in d
            assert "risk_level"  in d
            assert "alert"       in d
            assert 0.0 <= d["risk_score"] <= 1.0
            assert d["risk_level"] in ("LOW","MEDIUM","HIGH","CRITICAL","UNKNOWN")

    def test_predict_sensor_zero_values(self):
        r = client.post("/predict/sensor", json={
            "vibration": 0.0, "displacement": 0.0,
            "pore_pressure": 0.0, "strain": 0.0,
        })
        assert r.status_code in (200, 503)

    def test_predict_sensor_invalid_json(self):
        r = client.post("/predict/sensor",
                        content=b"not-json",
                        headers={"Content-Type": "application/json"})
        assert r.status_code == 422


class TestImageEndpoint:
    def _make_png(self, w=64, h=64):
        """Create a minimal valid PNG in memory."""
        try:
            from PIL import Image as PILImage
            img = PILImage.fromarray(
                __import__("numpy").zeros((h, w, 3), dtype="uint8")
            )
            buf = io.BytesIO(); img.save(buf, "PNG"); buf.seek(0)
            return buf
        except ImportError:
            pytest.skip("PIL not installed")

    def test_predict_image_success(self):
        buf = self._make_png()
        r = client.post("/predict/image",
                        files={"file": ("test.png", buf, "image/png")})
        # 200 if seg model loaded, 503 if not trained yet
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            d = r.json()
            assert "risk_score"   in d
            assert "coverage_pct" in d
            assert 0.0 <= d["risk_score"]   <= 1.0
            assert 0.0 <= d["coverage_pct"] <= 100.0

    def test_predict_image_no_file(self):
        r = client.post("/predict/image")
        assert r.status_code == 422

    def test_predict_image_empty_file(self):
        r = client.post("/predict/image",
                        files={"file": ("empty.png", io.BytesIO(b""), "image/png")})
        assert r.status_code in (400, 422, 500)


class TestFusionEndpoint:
    def test_predict_final_sensor_only(self):
        r = client.post("/predict/final", data={
            "vibration": "0.8", "displacement": "5.2",
            "pore_pressure": "1.8", "strain": "0.9",
            "temperature": "25.0", "rainfall": "0.0",
        })
        assert r.status_code == 200
        d = r.json()
        assert "final_risk_score" in d
        assert "risk_level"       in d
        assert "mode"             in d
        assert "confidence"       in d
        assert "recommendation"   in d
        assert 0.0 <= d["final_risk_score"] <= 1.0

    def test_predict_final_returns_explainability(self):
        r = client.post("/predict/final", data={"vibration":"0.5","displacement":"2.0"})
        assert r.status_code == 200
        d = r.json()
        assert "explainability" in d
        exp = d["explainability"]
        assert "sensor_score"  in exp
        assert "image_score"   in exp
        assert "sensor_weight" in exp
        assert "image_weight"  in exp
        assert "divergence"    in exp

    def test_predict_final_with_image(self):
        try:
            from PIL import Image as PILImage
            import numpy as np
            buf = io.BytesIO()
            PILImage.fromarray(np.zeros((64,64,3), dtype="uint8")).save(buf,"PNG")
            buf.seek(0)
        except ImportError:
            pytest.skip("PIL not installed")
        r = client.post("/predict/final",
                        data={"vibration":"0.8","displacement":"5.2"},
                        files={"file":("test.png",buf,"image/png")})
        assert r.status_code == 200


class TestDemoEndpoint:
    def test_predict_demo(self):
        r = client.get("/predict/demo")
        assert r.status_code == 200
        d = r.json()
        assert d.get("demo") is True
        assert "final_risk_score" in d
        assert "risk_level"       in d
        assert "mode"             in d
        assert 0.0 <= d["final_risk_score"] <= 1.0

    def test_predict_demo_has_sensor_inputs(self):
        r = client.get("/predict/demo")
        assert r.status_code == 200
        assert "demo_sensor_inputs" in r.json()

    def test_model_info(self):
        r = client.get("/predict/model-info")
        assert r.status_code == 200
        d = r.json()
        assert "models_loaded" in d
        assert "endpoints"     in d
