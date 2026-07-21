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

* **GitHub Repository**: [github.com/chapranishika/rockfall-ai](https://github.com/chapranishika/rockfall-ai)
* **Hugging Face Space (FastAPI Backend)**: [huggingface.co/spaces/Nishika1202/rockfall-backend](https://huggingface.co/spaces/Nishika1202/rockfall-backend)
  * *API Endpoint*: `https://nishika1202-rockfall-backend.hf.space`
* **Vercel Web Application (Next.js UI)**: [updated-rockfall-7j5r-chapranishika-6036s-projects.vercel.app](https://updated-rockfall-7j5r-chapranishika-6036s-projects.vercel.app)

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

### 1. Enterprise System Architecture
![Geophysical Safety Platform: Enterprise Architecture](screenshots/architecture_diagram.png)

---

### 2. Tourist Slope Safety Portal

* **Initial Tourist Search Portal (Dark Theme)**:
  ![Tourist Slope Safety Portal - Dark Mode](screenshots/dark_mode_dashboard.png)
  
* **Slope Safety Search Dashboard (Light Theme)**:
  ![Slope Safety Assessment - Light Mode](screenshots/light_mode_dashboard.png)

* **Tourist Slope Safety Initial State (Dark Theme)**:
  ![Tourist Slope Safety - Dark Search](screenshots/tourist_slope_dark.png)

* **Safety Assessment Report - Yosemite Valley (Medium Risk - 38%)**:
  ![Safety Report Yosemite](screenshots/worker_yosemite_report.png)

* **Safety Assessment Report - Navi Mumbai (Low Risk - 0%)**:
  ![Safety Report Mumbai](screenshots/tourist_mumbai_report.png)

* **Climatological & Telemetry Integration (Navi Mumbai)**:
  ![Mumbai Weather & Telemetry](screenshots/tourist_mumbai_telemetry.png)

* **Adjacent Micro-Terrain Hazard Breakdowns (Navi Mumbai)**:
  ![Mumbai Terrain Breakdown](screenshots/tourist_mumbai_terrains.png)

* **Telemetry & Vision Weight Score Distribution**:
  ![Weights Breakdown](screenshots/tourist_weights_breakdown.png)

---

### 3. Worker Geophysical Monitoring Dashboard

* **Live Monitoring Overview Dashboard (65% Medium Risk)**:
  ![Worker Live Dashboard](screenshots/worker_dashboard_live.png)

* **Real-Time Geotechnical Sensors Telemetry (Active WebSockets & Database Sync)**:
  ![Worker Sensors Live](screenshots/worker_sensors_live.png)

* **Spatial Risk Grid Heatmap (Multi-Modal Slope Risk Grid)**:
  ![Worker Heatmap Grid](screenshots/worker_heatmap_grid.png)

* **Drone Image Segmentation Analysis (U-Net + ResNet34 Custom Model)**:
  ![Worker Image Analysis](screenshots/worker_image_analysis.png)

* **Session Analytics & Historical CSV Logs Exports**:
  ![Worker Reports CSV](screenshots/worker_reports_csv.png)

* **Worker Dashboard Offline State Verification**:
  ![Worker Dashboard Offline](screenshots/worker_dashboard_offline.png)

* **Adjacent Micro-Terrain Hazard breakdowns (Worker View)**:
  ![Worker Terrain Breakdown](screenshots/worker_terrain_breakdown.png)

---

### 4. Setup, Deployment & Development Reference

* **Render Blueprint Billing Validation Checks**:
  ![Render Deployment Issue](screenshots/render_deployment_issue.png)
  
* **Android LocationTracker Project Gradle Sync**:
  ![Android Studio Setup](screenshots/android_studio_setup.png)


