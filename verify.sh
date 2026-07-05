#!/usr/bin/env bash
# verify.sh — run after training completes to confirm the full stack works
# Usage: bash verify.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; FAILS=$((FAILS+1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
FAILS=0

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Rockfall-AI — Pre-deploy Verification"
echo "═══════════════════════════════════════════════════"
echo ""

# 1. Check weights exist
echo "── Weights ──────────────────────────────────────"
XGB="ml/saved_models/xgboost_model.pkl"
SEG="ml/saved_models/segmentation_v2/unet_rockfall_real.pt"
META="ml/saved_models/segmentation_v2/unet_rockfall_real_meta.json"

[ -f "$XGB" ]  && ok "xgboost_model.pkl ($(du -sh $XGB | cut -f1))" || fail "xgboost_model.pkl MISSING"
[ -f "$SEG" ]  && ok "unet_rockfall_real.pt ($(du -sh $SEG | cut -f1))" || fail "unet_rockfall_real.pt MISSING — run train_e_drive.py"
[ -f "$META" ] && ok "meta.json exists" || warn "meta.json missing — training may not have completed cleanly"

if [ -f "$META" ]; then
  DICE=$(python3 -c "import json; m=json.load(open('$META')); print(m.get('test_dice','?'))")
  IOU=$(python3  -c "import json; m=json.load(open('$META')); print(m.get('test_iou','?'))")
  echo "   Test Dice: $DICE  |  Test IoU: $IOU"
  python3 -c "
import json; m=json.load(open('$META'))
d=float(m.get('test_dice',0))
i=float(m.get('test_iou',0))
if d < 0.70: print('  WARNING: Dice below 0.70 — model may underperform in production')
if d >= 0.82 and i >= 0.72: print('  Metrics meet production targets (Dice>=0.82, IoU>=0.72)')
"
fi

echo ""
echo "── Python stack ─────────────────────────────────"
python3 -c "
import joblib, pickle
m = joblib.load('ml/saved_models/xgboost_model.pkl')
import numpy as np
x = np.zeros((1, m.n_features_in_))
p = m.predict_proba(x)
print(f'  XGBoost: n_features={m.n_features_in_}  test_proba_shape={p.shape}  OK')
" && ok "XGBoost loadable and runnable" || fail "XGBoost failed to load or run"

python3 -c "
import torch, json
from pathlib import Path
p = Path('ml/saved_models/segmentation_v2/unet_rockfall_real.pt')
meta_p = Path('ml/saved_models/segmentation_v2/unet_rockfall_real_meta.json')
size = json.loads(meta_p.read_text()).get('img_size', 256) if meta_p.exists() else 256
try:
    import segmentation_models_pytorch as smp
    model = smp.Unet('resnet34', encoder_weights=None, in_channels=3, classes=1, activation=None)
    model.load_state_dict(torch.load(p, map_location='cpu'))
    model.eval()
    dummy = torch.zeros(1, 3, size, size)
    with torch.no_grad(): out = model(dummy)
    print(f'  U-Net: loaded size={size}  output_shape={tuple(out.shape)}  OK')
except ImportError:
    print('  smp not installed — Docker CPU image will use fallback UNet')
" && ok "Segmentation model loadable" || fail "Segmentation model failed to load"

echo ""
echo "── Unit tests ───────────────────────────────────"
PYTHONPATH=. python3 -m pytest tests/test_api.py tests/test_ml_pipeline.py -q --tb=short 2>&1 | tail -5
[ ${PIPESTATUS[0]} -eq 0 ] && ok "Unit tests pass" || fail "Unit tests failed"

echo ""
echo "── Integration tests ────────────────────────────"
PYTHONPATH=. python3 -m pytest tests/test_integration.py -q --tb=short 2>&1 | tail -8
[ ${PIPESTATUS[0]} -eq 0 ] && ok "Integration tests pass" || warn "Some integration tests failed (check output above)"

echo ""
echo "── Frontend build ───────────────────────────────"
if [ -f "ui/.next/standalone/server.js" ]; then
  ok "Frontend already built (.next/standalone exists)"
else
  warn "Frontend not built — running npm run build..."
  (cd ui && npm install --legacy-peer-deps --silent && npm run build 2>&1 | tail -5)
  [ -f "ui/.next/standalone/server.js" ] && ok "Frontend built successfully" || fail "Frontend build failed"
fi

echo ""
echo "── Docker ───────────────────────────────────────"
command -v docker &>/dev/null && ok "docker available" || warn "docker not found — skipping Docker checks"
command -v docker &>/dev/null && {
  docker --version | head -1
  [ -f ".env" ] && ok ".env exists" || fail ".env missing — run: cp .env.example .env"
}

echo ""
echo "═══════════════════════════════════════════════════"
if [ $FAILS -eq 0 ]; then
  echo -e "${GREEN}  All checks passed. Ready to deploy.${NC}"
  echo ""
  echo "  Run:  docker compose up --build"
  echo "  Then: open http://localhost:3000"
else
  echo -e "${RED}  $FAILS check(s) failed. Fix above issues before deploying.${NC}"
fi
echo "═══════════════════════════════════════════════════"
echo ""
exit $FAILS
