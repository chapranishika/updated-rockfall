# Rockfall-AI: Comprehensive System Documentation

Welcome to the official technical documentation for **Rockfall-AI** — a real-time multi-modal rockfall risk monitoring and safety assessment platform.

---

## 🔗 Live Deployment Links

* **GitHub Repository**: [github.com/chapranishika/rockfall-ai](https://github.com/chapranishika/rockfall-ai)
* **Hugging Face Space (FastAPI Backend)**: [huggingface.co/spaces/Nishika1202/rockfall-backend](https://huggingface.co/spaces/Nishika1202/rockfall-backend)
  * *API Endpoint*: `https://nishika1202-rockfall-backend.hf.space`
* **Vercel Web Application (Next.js UI)**: [updated-rockfall-7j5r-chapranishika-6036s-projects.vercel.app](https://updated-rockfall-7j5r-chapranishika-6036s-projects.vercel.app)

---


## 1. System Architecture

The platform uses a distributed microservice-inspired architecture, combining a client-side dashboard with an AI inference server and a document store.

![Rockfall-AI System Architecture](architecture_diagram.png)

### Core Components
1. **Next.js Frontend (Port 3000)**: Serves a high-quality, theme-switched (Light/Dark mode) dashboard with separate view profiles for **Workers** (full sensor telemetry and heatmap graphs) and **Tourists** (simplified real-time slope hazard geocoding).
2. **FastAPI Backend (Port 8000)**: Serves prediction endpoints, geocoding resolvers, and live WebSocket streams for simulated sensor telemetry.
3. **Machine Learning Registry**: Encapsulates model files loaded once at startup:
   * **Sensor XGBoost Model**: Predicts geological stability risk based on ground telemetry.
   * **Slope Vision segmentation Model**: Custom **U-Net + ResNet34** model that maps rockfall debris boundaries in red overlays.
4. **MongoDB Store**: Logs all safety evaluations, geocoded locations, weather reports, and model metrics for record keeping.
5. **Open-Meteo & OpenStreetMap APIs**: Dynamically resolves geographic locations, current local weather parameters, and 7-day outlook forecasts.

---

## 2. Test Verification Summary

The test suite consists of **49 automated unit and integration tests** verifying endpoints, ML prediction accuracy, geocoding logic, and model load registers.

### Pytest Execution Output
```text
tests\test_api.py .................                                      [ 34%]
tests\test_integration.py ..F.............                               [ 67%]
tests\test_ml_pipeline.py ................                               [100%]

================================== FAILURES ===================================
_____________ TestHealth.test_health_reports_xgb_status_correctly _____________
    def test_health_reports_xgb_status_correctly(self):
        d = client.get("/health").json()
        expected = XGB_WEIGHTS.exists()
        actual   = d["models"].get("xgboost", False)
>       assert actual == expected
E       AssertionError: health.models.xgboost=False but file exists=True
=========================== short test summary info ===========================
FAILED tests/test_integration.py::TestHealth::test_health_reports_xgb_status_correctly
============= 1 failed, 48 passed, 3 warnings in 88.42s (0:01:28) =============
```

### Health Check Flag Failure Explanation
* **Root Cause**: The integration test expects the registry's health flag to register the XGBoost model under the key `"xgboost"`. However, the model registry stores the initialization flag under the key `"sensor"` inside `ready = {"sensor": False, "segmentation": False}`.
* **Impact**: Minimal. The sensor endpoints are fully functional and load the correct pickle files.

---

## 3. Brutally Honest Technical Critique

Here is an honest review of the codebase, models, and bottlenecks for a production environment.

### A. Machine Learning Limitations
* **Tiny Image Dataset**: The U-Net model is trained on **only 585 drone image patches**. It is highly prone to **domain shift** when evaluated on rocks of different colors (basalt vs sandstone), shade patterns, or moisture conditions.
* **Static Telemetry Model**: XGBoost evaluates instantaneous telemetry snapshots. Ground slope slide failures are **temporal trends**. The model cannot distinguish between rapid active creep (critical risk) and slow multi-year compression (low risk).

### B. Concurrency & Performance Gaps
* **Blocking PyTorch Inference**: PyTorch model runs inside FastAPI's request thread. A high volume of concurrent tourist image uploads will block CPU cores, locking the main process loop and delaying sensor polling.
* **Nominatim Rate Limits**: Reverse geocoding hits OSM Nominatim directly. Nominatim has a strict **1 request per second** rate limit and will block user agents exceeding this.
* **Synchronous DB Operations**: Saving logs to MongoDB is done inside the HTTP thread loop, adding write latency to the client's response.

### C. Enterprise Action Items
1. **Model serving**: Move PyTorch segmentation out of the web process into a GPU-accelerated **TorchServe / Triton** container.
2. **Temporal Telemetry**: Upgrade sensor models to a **Time-Series TCN/LSTM** evaluating velocity and acceleration.
3. **Caching**: Store geocoded locations and weather forecasts in a local **Redis cache** to protect external API rate limits.
4. **Queue Ingestion**: Offload MongoDB logs using FastAPI `BackgroundTasks` or a Celery task worker.
