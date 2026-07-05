#!/usr/bin/env python3
"""
Rockfall-AI  |  U-Net Segmentation  |  Optimised for 16GB RAM / E: drive

RUN:
    cd E:\\rockfall-ai
    python ml\\segmentation_v2\\train_e_drive.py
    python ml\\segmentation_v2\\train_e_drive.py --size 512 --batch 8   # best quality
    python ml\\segmentation_v2\\train_e_drive.py --size 768 --batch 4   # even better

INSTALL (once):
    pip install torch torchvision segmentation-models-pytorch
    pip install albumentations pillow numpy tqdm pandas scikit-learn

Expected (512px, imagenet, 16GB, ~45 min):
    Val  Dice >= 0.82   Test IoU >= 0.72
"""
from __future__ import annotations
import argparse, gc, json, random, sys, time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# ── Defaults ───────────────────────────────────────────────────────────────────
IMG_SIZE  = 512; BATCH = 8; LR = 1e-4
P1_EPOCHS = 8; P2_EPOCHS = 22; PATIENCE = 10; POS_WEIGHT = 2.5
MEAN = np.array([0.485,0.456,0.406],dtype=np.float32)
STD  = np.array([0.229,0.224,0.225],dtype=np.float32)
ROCKFALL_RGB = (0,110,255)

IMG_DIRS  = [ROOT/"data/drone/images/patch_1", ROOT/"data/drone/images/patch_1011"]
MASKS_DIR = ROOT/"data/drone/masks"
SAVE_DIR  = ROOT/"ml/saved_models/segmentation_v2"
SAVE_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = SAVE_DIR/"unet_rockfall_real.pt"
META_PATH  = SAVE_DIR/"unet_rockfall_real_meta.json"
SAMPLE_DIR = SAVE_DIR/"sample_predictions"
SAMPLE_DIR.mkdir(exist_ok=True)


def find_pairs():
    by = {}
    for d in IMG_DIRS:
        for p in d.glob("*.png"): by[p.name] = p
    pairs = [(by[mp.name],mp) for mp in sorted(MASKS_DIR.glob("*.png")) if mp.name in by]
    print(f"  Paired: {len(pairs)} samples"); return pairs

def mask_bin(rgb): return np.all(rgb==ROCKFALL_RGB,axis=-1).astype(np.float32)

def stratified_split(pairs, vf=0.15, tf=0.10, seed=42):
    rng=random.Random(seed)
    covs=[mask_bin(np.array(Image.open(mp).convert("RGB").resize((64,64),Image.NEAREST))).mean() for _,mp in pairs]
    cuts=np.percentile(covs,[20,40,60,80]); strata=np.digitize(covs,cuts)
    tr,va,te=[],[],[]
    for s in range(5):
        idx=[i for i,st in enumerate(strata) if st==s]; rng.shuffle(idx); n=len(idx)
        nte=max(1,int(n*tf)); nva=max(1,int(n*vf))
        te+=[pairs[i] for i in idx[:nte]]; va+=[pairs[i] for i in idx[nte:nte+nva]]; tr+=[pairs[i] for i in idx[nte+nva:]]
    print(f"  Split: train={len(tr)} val={len(va)} test={len(te)}"); return tr,va,te


class RockfallDS(torch.utils.data.Dataset):
    """
    Real drone dataset. PIL loader avoids cv2 1024px memory spikes.
    Positive class: RGB(0,110,255) = rockfall (verified vs BinaryMasks).
    """
    def __init__(self,pairs,size,aug=False): self.pairs=pairs; self.size=size; self.aug=aug
    def __len__(self): return len(self.pairs)
    def __getitem__(self,i):
        ip,mp=self.pairs[i]
        img=np.array(Image.open(ip).convert("RGB").resize((self.size,self.size)),dtype=np.float32)
        img_t=torch.from_numpy(((img/255.0-MEAN)/STD).transpose(2,0,1))
        msk=np.array(Image.open(mp).convert("RGB").resize((self.size,self.size),Image.NEAREST))
        msk_t=torch.from_numpy(mask_bin(msk)).unsqueeze(0)
        if self.aug: img_t,msk_t=self._aug(img_t,msk_t)
        return img_t,msk_t
    @staticmethod
    def _aug(img,msk):
        if random.random()>0.5: img=img.flip(-1); msk=msk.flip(-1)
        if random.random()>0.5: img=img.flip(-2); msk=msk.flip(-2)
        if random.random()>0.5:
            k=random.randint(1,3); img=torch.rot90(img,k,[-2,-1]); msk=torch.rot90(msk,k,[-2,-1])
        if random.random()>0.4: img=(img*random.uniform(0.75,1.30)).clamp(-3,3)
        if random.random()>0.5:
            m=img.mean([-2,-1],keepdim=True); img=((img-m)*random.uniform(0.80,1.25)+m).clamp(-3,3)
        if random.random()>0.5: img=(img+torch.randn_like(img)*random.uniform(0.01,0.04)).clamp(-3,3)
        if random.random()>0.92: img=img[torch.randperm(3)]
        return img,msk


def build_unet(enc_weights="imagenet",device=torch.device("cpu")):
    import segmentation_models_pytorch as smp
    try:
        m=smp.Unet("resnet34",encoder_weights=enc_weights,in_channels=3,classes=1,activation=None)
    except Exception:
        print("  WARNING: falling back to random init")
        m=smp.Unet("resnet34",encoder_weights=None,in_channels=3,classes=1,activation=None)
    print(f"  U-Net ResNet34  {sum(p.numel() for p in m.parameters()):,} params  enc={enc_weights}")
    return m.to(device)


class Loss(nn.Module):
    def __init__(self,pw=POS_WEIGHT):
        super().__init__()
        self.bce=nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pw]))
    def forward(self,l,t):
        b=self.bce(l,t); p=torch.sigmoid(l).reshape(l.size(0),-1); tf=t.reshape(t.size(0),-1)
        d=1-((2*(p*tf).sum(1)+1)/(p.sum(1)+tf.sum(1)+1)).mean()
        return 0.5*b+0.5*d


def metrics(model,dl,device):
    model.eval(); ds,us,ps,rs=[],[],[],[]; eps=1e-6
    with torch.no_grad():
        for imgs,msks in dl:
            imgs,msks=imgs.to(device),msks.to(device)
            pr=(torch.sigmoid(model(imgs))>0.45).float()
            pf=pr.reshape(-1); tf=msks.reshape(-1)
            tp=(pf*tf).sum(); fp=(pf*(1-tf)).sum(); fn=((1-pf)*tf).sum()
            uni=pf.sum()+tf.sum()-tp
            ds.append(float((2*tp+eps)/(pf.sum()+tf.sum()+eps)))
            us.append(float((tp+eps)/(uni+eps)))
            ps.append(float((tp+eps)/(tp+fp+eps)))
            rs.append(float((tp+eps)/(tp+fn+eps)))
    return [float(np.mean(x)) for x in [ds,us,ps,rs]]


def save_samples(model,pairs,size,device,n=8):
    model.eval(); print(f"\n  Saving {min(n,len(pairs))} samples...")
    for i,(ip,mp) in enumerate(pairs[:n]):
        disp=np.array(Image.open(ip).convert("RGB").resize((512,512)))
        gt=mask_bin(np.array(Image.open(mp).convert("RGB").resize((512,512),Image.NEAREST))).astype(bool)
        img=np.array(Image.open(ip).convert("RGB").resize((size,size)),dtype=np.float32)
        t=torch.from_numpy(((img/255.0-MEAN)/STD).transpose(2,0,1)).unsqueeze(0).to(device)
        with torch.no_grad(): prob=torch.sigmoid(model(t)).squeeze().cpu().numpy()
        prob_up=np.array(Image.fromarray(prob).resize((512,512),Image.BILINEAR)); pred=prob_up>0.45
        def bl(img,m,c,a=0.45):
            o=img.copy().astype(float); o[m]=o[m]*(1-a)+np.array(c)*a; return o.clip(0,255).astype(np.uint8)
        panel=np.concatenate([disp,bl(disp,gt,(0,110,255)),bl(disp,pred,(255,60,60))],axis=1)
        pf=torch.from_numpy(pred.astype(np.float32)).reshape(-1)
        gf=torch.from_numpy(gt.astype(np.float32)).reshape(-1)
        d=float((2*(pf*gf).sum()+1e-6)/(pf.sum()+gf.sum()+1e-6))
        u=float(((pf*gf).sum()+1e-6)/((pf+gf-(pf*gf)).sum()+1e-6))
        op=SAMPLE_DIR/f"sample_{i:02d}_dice{d:.3f}_iou{u:.3f}.png"
        Image.fromarray(panel).save(op)
        print(f"    {op.name}  gt={gt.mean()*100:.1f}%  pred={pred.mean()*100:.1f}%")


def train(size=IMG_SIZE,batch=BATCH,lr=LR,p1=P1_EPOCHS,p2=P2_EPOCHS,enc_weights="imagenet",patience=PATIENCE):
    t0=time.time(); device=torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(42); random.seed(42); np.random.seed(42)
    print("\n"+"═"*62)
    print("  Rockfall-AI  ─  U-Net  ─  Real Drone Dataset (PRIMARY)")
    print("═"*62)
    print(f"  device={device}  size={size}px  batch={batch}  lr={lr}")
    print(f"  p1={p1}(frozen)  p2={p2}(finetune)  enc={enc_weights}")

    pairs=find_pairs(); tr_p,val_p,te_p=stratified_split(pairs)
    tr_dl=torch.utils.data.DataLoader(RockfallDS(tr_p, size,True), batch_size=batch,shuffle=True, num_workers=4,pin_memory=device.type=="cuda")
    vl_dl=torch.utils.data.DataLoader(RockfallDS(val_p,size,False),batch_size=batch*2,shuffle=False,num_workers=4)
    te_dl=torch.utils.data.DataLoader(RockfallDS(te_p, size,False),batch_size=batch*2,shuffle=False,num_workers=4)
    print(f"  batches: train={len(tr_dl)} val={len(vl_dl)} test={len(te_dl)}")

    model=build_unet(enc_weights,device); crit=Loss(POS_WEIGHT).to(device)
    best_dice=0.0; best_state=None; hist=[]

    def do_train(opt):
        model.train(); ls=[]
        for imgs,msks in tqdm(tr_dl,desc="  train",leave=False):
            imgs,msks=imgs.to(device),msks.to(device)
            opt.zero_grad(); loss=crit(model(imgs),msks); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
            ls.append(loss.item()); del imgs,msks,loss; gc.collect()
        return float(np.mean(ls))

    print(f"\n── Phase 1: Frozen encoder ({p1} epochs) ──────────────────")
    for p in model.encoder.parameters(): p.requires_grad=False
    o1=torch.optim.AdamW(filter(lambda p:p.requires_grad,model.parameters()),lr=lr*2,weight_decay=1e-4)
    for ep in range(1,p1+1):
        tl=do_train(o1); d,u,prec,rec=metrics(model,vl_dl,device)
        s=" ★" if d>best_dice else ""
        print(f"  P1 {ep:02d}/{p1}  tr={tl:.4f}  Dice={d:.4f}  IoU={u:.4f}  P={prec:.3f}  R={rec:.3f}{s}",flush=True)
        hist.append({"ph":1,"ep":ep,"tr":round(tl,4),"vd":round(d,4),"vi":round(u,4)})
        if d>best_dice: best_dice=d; best_state={k:v.clone() for k,v in model.state_dict().items()}

    print(f"\n── Phase 2: Full fine-tune ({p2} epochs, diff LR) ──────────")
    for p in model.encoder.parameters(): p.requires_grad=True
    ep_=[p for n,p in model.named_parameters() if "encoder" in n]
    dp_=[p for n,p in model.named_parameters() if "encoder" not in n]
    o2=torch.optim.AdamW([{"params":ep_,"lr":lr*0.1},{"params":dp_,"lr":lr}],weight_decay=1e-4)
    sch=torch.optim.lr_scheduler.CosineAnnealingLR(o2,T_max=p2,eta_min=lr*0.005); pat=0
    for ep in range(1,p2+1):
        tl=do_train(o2); d,u,prec,rec=metrics(model,vl_dl,device); sch.step()
        s=" ★" if d>best_dice else ""
        print(f"  P2 {ep:02d}/{p2}  tr={tl:.4f}  Dice={d:.4f}  IoU={u:.4f}  P={prec:.3f}  R={rec:.3f}{s}",flush=True)
        hist.append({"ph":2,"ep":p1+ep,"tr":round(tl,4),"vd":round(d,4),"vi":round(u,4)})
        if d>best_dice:
            best_dice=d; best_state={k:v.clone() for k,v in model.state_dict().items()}
            pat=0; torch.save(best_state,SAVE_DIR/"best_checkpoint.pt")
        else:
            pat+=1
            if pat>=patience: print(f"  Early stop (patience={patience})"); break

    model.load_state_dict(best_state); model.eval()
    td,ti,tp,tr_r=metrics(model,te_dl,device); tf1=2*tp*tr_r/(tp+tr_r+1e-6); elapsed=time.time()-t0

    print(f"\n{'═'*62}")
    print(f"  TEST RESULTS")
    for name,val in [("Dice",td),("IoU",ti),("Precision",tp),("Recall",tr_r),("F1",tf1)]:
        print(f"  {name:<12} {val:.4f}")
    print(f"  Time         {elapsed/60:.1f} min")
    print(f"{'═'*62}")

    torch.save(model.state_dict(),MODEL_PATH)
    import pandas as pd
    meta={"model":"U-Net+ResNet34 (PRIMARY — real drone)","encoder":"resnet34","encoder_weights":enc_weights,
          "img_size":size,"batch_size":batch,"n_train":len(tr_p),"n_val":len(val_p),"n_test":len(te_p),
          "task":"Binary: rockfall RGB(0,110,255) vs terrain",
          "label_source":"Masks/ (0,110,255)=rockfall — 100% overlap vs BinaryMasks verified",
          "augmentation":"hflip vflip rot90 brightness contrast noise channel_shuffle",
          "loss":"0.5*BCE + 0.5*Dice  pos_weight=2.5",
          "best_val_dice":round(best_dice,4),"test_dice":round(td,4),"test_iou":round(ti,4),
          "test_precision":round(tp,4),"test_recall":round(tr_r,4),"test_f1":round(tf1,4),
          "epochs_run":len(hist),"training_min":round(elapsed/60,1),"history":hist,
          "trained_at":str(pd.Timestamp.now())[:19],
          "note":"PRIMARY model. Separate from TinyUNet placeholder."}
    META_PATH.write_text(json.dumps(meta,indent=2))
    print(f"\n  Model  → {MODEL_PATH}\n  Meta   → {META_PATH}")
    save_samples(model,te_p,size,device,n=8)
    print(f"  Samples→ {SAMPLE_DIR}")
    print(f"\n✅  Done in {elapsed/60:.1f} min\n")
    return meta

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--size",   type=int,   default=IMG_SIZE)
    ap.add_argument("--batch",  type=int,   default=BATCH)
    ap.add_argument("--lr",     type=float, default=LR)
    ap.add_argument("--p1",     type=int,   default=P1_EPOCHS)
    ap.add_argument("--p2",     type=int,   default=P2_EPOCHS)
    ap.add_argument("--patience",type=int,  default=PATIENCE)
    ap.add_argument("--encoder-weights",default="imagenet")
    a=ap.parse_args()
    enc=None if a.encoder_weights.lower()=="none" else a.encoder_weights
    train(a.size,a.batch,a.lr,a.p1,a.p2,enc,a.patience)
