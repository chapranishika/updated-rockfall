# Rockfall-AI — E: Drive Setup

## Quick Start (16GB RAM, CPU)

```bash
cd E:\rockfall-ai

# 1. Install dependencies (once)
pip install -r requirements.txt

# 2. Set up data directories
python ml/segmentation_v2/data/setup_data.py \
  --images_1 data/raw/patch_1/ \
  --images_2 data/raw/patch_1011/ \
  --masks    data/raw/Masks/ \
  --binary   data/raw/BinaryMasks/

# 3. Train segmentation model (PRIMARY — ~45 min on 16GB CPU)
python ml/segmentation_v2/train_e_drive.py
#   Default: 512px, batch=8, 30 epochs, imagenet encoder
#   Output: ml/saved_models/segmentation_v2/unet_rockfall_real.pt

# Higher quality (if time allows):
python ml/segmentation_v2/train_e_drive.py --size 768 --batch 4 --p2 40

# 4. Start backend API
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
#   Docs: http://localhost:8000/docs

# 5. Test image endpoint
curl -X POST http://localhost:8000/predict/image \
  -F "file=@data/drone/masks/patch_1.png"
```

## Expected Results (512px, imagenet encoder, 16GB RAM)

| Metric    | Expected |
|-----------|---------|
| Val Dice  | ≥ 0.82  |
| Test IoU  | ≥ 0.72  |
| Test F1   | ≥ 0.80  |

## API Endpoints

| Method | Endpoint         | Description                        |
|--------|------------------|------------------------------------|
| POST   | /predict/sensor  | XGBoost sensor risk score          |
| POST   | /predict/image   | U-Net segmentation + overlay       |
| POST   | /predict/final   | Fused sensor + image prediction    |
| GET    | /predict/demo    | Demo (no input needed)             |
| GET    | /predict/model-info | Model registry status           |
| GET    | /docs            | Interactive Swagger UI             |

## Model Details

**Architecture**: U-Net + ResNet34 encoder (ImageNet pretrained)
**Dataset**: 585 real RGBA drone images (patch_1 + patch_1011)
**Task**: Binary segmentation — rockfall RGB(0,110,255) vs terrain
**Labels**: Verified 100% pixel overlap with BinaryMasks ground truth
**Training**: Two-phase (frozen encoder → full fine-tune, cosine LR, early stop)
**Augmentation**: hflip, vflip, rot90, brightness, contrast, gaussian noise, channel shuffle
