# Rockfall-AI — Complete Runbook
# From zero to GitHub to deployed

---

## PHASE 1 — Train the segmentation model (~45 min, run now)

Open a terminal, run this, then leave it running in the background:

```
cd /d E:\Projects\Rockfall\rockfall-v4-complete\rockfall-docker-fix
python ml\segmentation_v2\train_e_drive.py --size 512 --batch 8
```

You'll see epoch progress. When it finishes it prints:
  ✓ Saved: ml/saved_models/segmentation_v2/unet_rockfall_real.pt
  Test Dice: 0.XX  Test IoU: 0.XX

While that runs, do Phase 2 and 3 in a second terminal.

---

## PHASE 2 — Verify everything (second terminal, while training runs)

```
cd /d E:\Projects\Rockfall\rockfall-v4-complete\rockfall-docker-fix

pip install -r requirements.txt

PYTHONPATH=. python -m pytest tests\test_api.py tests\test_ml_pipeline.py -v
```

Expected: all tests pass. If any fail, paste output.

After training finishes, run the full check:
```
bash verify.sh
```
Expected: "All checks passed. Ready to deploy."

---

## PHASE 3 — GitHub

### 3a. Create the repo

Go to https://github.com/new
- Repository name: rockfall-ai
- Private (recommended until you're ready to publish)
- Do NOT initialise with README (you already have one)
- Click "Create repository"

### 3b. Initialise git and push

```
cd /d E:\Projects\Rockfall\rockfall-v4-complete\rockfall-docker-fix

git init
git add .
git commit -m "feat: initial Rockfall-AI implementation

- FastAPI backend with singleton ModelRegistry
- U-Net+ResNet34 segmentation on real drone imagery (585 patches)
- XGBoost sensor risk classifier (AUC=0.88)
- BCEDiceLoss two-phase training
- Ornstein-Uhlenbeck WebSocket sensor simulation
- Next.js 14 frontend (worker + tourist modes)
- Docker Compose deployment
- 33 unit tests + integration test suite"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rockfall-ai.git
git push -u origin main
```

Replace YOUR_USERNAME with your GitHub username.

### 3c. Check .gitignore is correct

The .gitignore must exclude these (already set):
  - ui/node_modules/
  - ui/.next/
  - ml/data/patch_*/        (drone images — too large for git)
  - ml/data/Masks/
  - ml/data/BinaryMasks/
  - __pycache__/
  - *.pyc

The trained weights (ml/saved_models/*.pkl, *.pt) should be committed —
they're the output of your training run and make the repo immediately runnable.

---

## PHASE 4 — Local Docker test (before cloud deploy)

```
cd /d E:\Projects\Rockfall\rockfall-v4-complete\rockfall-docker-fix

copy .env.example .env

docker compose build --no-cache
docker compose up
```

Open http://localhost:3000 — you should see the dashboard.
Test http://localhost:8000/health — should return {"status":"ok","models":{"sensor":true,"segmentation":true}}

If the UI can't reach the backend, check that NEXT_PUBLIC_API_URL=http://backend:8000 in your .env

To stop: Ctrl+C, then docker compose down

---

## PHASE 5 — Cloud deployment (Render — free tier, no credit card)

### 5a. Deploy backend

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo (rockfall-ai)
3. Settings:
   - Name: rockfall-ai-backend
   - Runtime: Docker
   - Dockerfile path: ./Dockerfile.backend
   - Instance type: Free (or Starter for always-on)
4. Environment variables (add these):
   - PYTHONUNBUFFERED = 1
5. Click Deploy

Your backend URL will be: https://rockfall-ai-backend.onrender.com
(Render assigns this — copy it for step 5b)

### 5b. Deploy frontend

1. New → Web Service
2. Same repo
3. Settings:
   - Name: rockfall-ai-ui
   - Runtime: Docker
   - Dockerfile path: ./Dockerfile.ui
4. Environment variables:
   - NEXT_PUBLIC_API_URL = https://rockfall-ai-backend.onrender.com
5. Click Deploy

Your app will be live at: https://rockfall-ai-ui.onrender.com

### Notes on free tier:
- Free services spin down after 15 min of inactivity (cold start ~30s)
- 512MB RAM — the segmentation model at 512px may be tight; if OOM, 
  re-train at --size 256 and redeploy
- For always-on production: upgrade to Starter ($7/mo per service)

---

## PHASE 6 — After deployment checklist

[ ] https://your-backend.onrender.com/health returns segmentation: true
[ ] https://your-frontend.onrender.com loads the dashboard
[ ] Worker mode shows all 7 nav items
[ ] Tourist mode shows only Safety Status
[ ] WebSocket sensor stream updates live on the Dashboard
[ ] POST /predict/sensor with JSON body returns risk_score
[ ] POST /predict/image with a drone image returns coverage_pct
[ ] Docker compose up works locally end-to-end

---

## Troubleshooting

**Backend OOM on Render free tier:**
  Re-train: python ml\segmentation_v2\train_e_drive.py --size 256 --batch 16
  Redeploy.

**Frontend can't connect to backend (CORS error in browser console):**
  Check NEXT_PUBLIC_API_URL is set to your backend's Render URL (not localhost).
  This is baked at build time — you must redeploy frontend after changing it.

**XGBoost version warning in logs:**
  Harmless. Model was re-saved in current format.

**train_e_drive.py fails with CUDA error:**
  Normal on CPU-only machine. Add --device cpu flag:
  python ml\segmentation_v2\train_e_drive.py --size 512 --batch 8 --device cpu

**npm run build fails:**
  Run: cd ui && npm install --legacy-peer-deps && npm run build
  The Card/CardSm style prop fix and next.config.js are already applied.
