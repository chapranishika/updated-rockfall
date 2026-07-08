---
title: Rockfall Backend
emoji: 🛡️
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Rockfall-AI: Multi-Modal Geophysical Safety & Alert Platform

A real-time, microservice-inspired geophysical monitoring platform that combines deep learning computer vision (U-Net) and tabular anomaly detection (XGBoost) to evaluate rockfall hazards and ensure tourist and worker safety.

---

## 🔗 Live Deployment Links

* **GitHub Repository**: [github.com/chapranishika/updated-rockfall](https://github.com/chapranishika/updated-rockfall)
* **Hugging Face Space (FastAPI Backend)**: [huggingface.co/spaces/Nishika1202/rockfall-backend](https://huggingface.co/spaces/Nishika1202/rockfall-backend)
  * *API Endpoint*: `https://nishika1202-rockfall-backend.hf.space`
* **Vercel Web Application (Next.js UI)**: [updated-rockfall-7j5r.vercel.app](https://updated-rockfall-7j5r.vercel.app)

---

## 🛠️ System Overview & Core Features

* **Real-Time Telemetry Stream**: Processes physical geological telemetry (displacement, vibration, pore pressure, strain) through an **XGBoost Classifier** to evaluate local slope stability risks.
* **Computer Vision Segmentation**: Employs a custom **U-Net + ResNet34** segmentation model to analyze tourist/drone images, generating visual heatmaps indicating active rockfall hazard boundaries.
* **Geocoded Weather Fusion**: Resolves live GPS coordinates via OSM Nominatim API to get location context (City, State, Country) and fetches weather parameters (temperature, daily description, and 7-day outlook precipitation) via Open-Meteo API.
* **MongoDB Record Keeping**: Logs geocoded locations, fused hazard scores, daily forecasts, and sensor telemetry metrics asynchronously.
* **Premium Glassmorphic UI**: High-standard UI with light/dark theme switcher using TailwindCSS, theme contexts, and clean SVG visual metrics.

---

## 💻 Tech Stack

* **Frontend**: Next.js 14, React, TailwindCSS, Lucide Icons, Recharts.
* **Backend**: FastAPI, PyTorch (CPU-Only), XGBoost, Motor (Async MongoDB), Git LFS.
* **Data Stores**: MongoDB Document Store.
* **APIs**: Open-Meteo, OpenStreetMap Nominatim.
* **Deployments**: Vercel (Frontend), Hugging Face Spaces (Backend).

---

## 📸 Screenshots & Architecture Gallery

### 1. Enterprise Architecture Diagram
![Geophysical Safety Platform: Enterprise Architecture](screenshots/architecture_diagram.png)

### 2. Tourist Slope Safety Portal (Dark Theme)
![Tourist Slope Safety Portal - Dark Mode](screenshots/dark_mode_dashboard.png)

### 3. Slope Safety Assessment (Light Theme)
![Slope Safety Assessment - Light Mode](screenshots/light_mode_dashboard.png)

### 4. Vercel & Render Setup Reference
* **Render Deployment Billing Validation**:
  ![Render Deployment Issue](screenshots/render_deployment_issue.png)
* **Android LocationTracker Project Sync**:
  ![Android Studio Setup](screenshots/android_studio_setup.png)

