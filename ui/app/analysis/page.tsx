"use client";
import { useCallback, useRef, useState } from "react";
import { api, ImageResult } from "@/lib/api";
import { Card, CardLabel, CardSm, Metric, RiskGauge, RiskBadge, RECS, rc } from "@/components/ui/index";

export default function AnalysisPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string|null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult]   = useState<ImageResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [drag, setDrag]       = useState(false);

  const onFile = useCallback((f:File) => {
    setFileName(f.name); setResult(null); setError("");
    const rd=new FileReader(); rd.onload=e=>setPreview(e.target?.result as string); rd.readAsDataURL(f);
  },[]);

  const analyse = useCallback(async () => {
    const f=fileRef.current?.files?.[0]; if(!f) return;
    setLoading(true); setError("");
    try { setResult(await api.predictImage(f)); }
    catch(e:unknown){ setError(e instanceof Error?e.message:"Failed"); }
    finally { setLoading(false); }
  },[]);

  const level = (result?.risk_level??"LOW").toUpperCase();
  const score = result?.risk_score??0;
  const c     = rc(level);

  return (
    <div className="p-5" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:"-.4px",color:"var(--txt)"}}>Image Analysis</h1>
          <p style={{fontSize:12,color:"var(--txt3)",marginTop:3}}>
            U-Net + ResNet34 · 585 real drone patches · rockfall RGB(0,110,255)
          </p>
        </div>
        <span style={{fontSize:10,padding:"3px 10px",borderRadius:99,background:"var(--acc-bg)",color:"var(--acc2)",border:"1px solid #4f8ef730",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>
          Primary ML model
        </span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

        {/* Upload column */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card>
            <CardLabel text="Upload drone image" />
            <div
              onClick={()=>fileRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setDrag(true);}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f&&fileRef.current){const dt=new DataTransfer();dt.items.add(f);fileRef.current.files=dt.files;onFile(f);}}}
              style={{border:`1.5px dashed ${drag?"var(--acc)":"var(--bdr2)"}`,borderRadius:12,padding:20,textAlign:"center",cursor:"pointer",background:drag?"var(--acc-bg)":"var(--bg2)",transition:"all .15s",minHeight:130,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,overflow:"hidden"}}>
              {preview
                ? <img src={preview} alt="preview" style={{maxHeight:110,objectFit:"contain",borderRadius:8,width:"100%"}}/>
                : <><span style={{fontSize:28}}>🛸</span><p style={{fontSize:13,fontWeight:500,color:"var(--txt)"}}>Drop image here</p><p style={{fontSize:10,color:"var(--txt3)"}}>PNG · JPEG · TIFF · up to 100MB</p></>}
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f);}}/>
            </div>
            {fileName&&<p style={{fontSize:10,color:"var(--acc2)",marginTop:6,letterSpacing:".02em"}}>📎 {fileName}</p>}
            <button onClick={analyse} disabled={!preview||loading}
              style={{width:"100%",marginTop:10,padding:"10px",background:"var(--acc)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:(!preview||loading)?.5:1}}>
              {loading?"⚙️ Running segmentation…":"🔬 Analyse image"}
            </button>
            {error&&<div style={{marginTop:8,padding:"8px 12px",background:"var(--hi-bg)",border:"1px solid var(--hi-bdr)",borderRadius:8,fontSize:11,color:"var(--hi)"}}>⚠️ {error}</div>}
          </Card>

          {result?.overlay_b64&&(
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg2)",borderBottom:"1px solid var(--bdr)"}}>
                <CardLabel text="Segmentation overlay" />
                <span style={{fontSize:10,color:"var(--hi)",fontWeight:600}}>■ rockfall detected</span>
              </div>
              <img src={`data:image/png;base64,${result.overlay_b64}`} alt="overlay" style={{width:"100%",maxHeight:200,objectFit:"contain",display:"block"}}/>
            </Card>
          )}
        </div>

        {/* Results column */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <CardLabel text="Risk assessment" />
            {result ? (
              <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                <RiskGauge score={score} level={level}/>
                <div style={{width:"100%",padding:"10px 14px",background:"var(--bg2)",borderRadius:12,textAlign:"center",border:`1px solid ${c}22`}}>
                  <p style={{fontSize:11,fontWeight:600,color:c,marginBottom:4}}>
                    {level} RISK — {RECS[level].split(".")[0]}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{padding:32,textAlign:"center",color:"var(--txt3)"}}>
                <span style={{fontSize:36,display:"block",marginBottom:10}}>🔭</span>
                <p style={{fontSize:12}}>Upload an image to see risk assessment</p>
              </div>
            )}
          </Card>

          {result&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Metric label="Coverage"   value={`${result.coverage_pct?.toFixed(1)}%`} accent={c} color={c} sub="Rockfall area"/>
                <Metric label="Mean prob"  value={`${((result.mean_prob??0)*100).toFixed(1)}%`} accent="var(--acc)" sub="Confidence"/>
              </div>
              <Card>
                <CardLabel text="Model details"/>
                {[
                  ["Model",        result.model??"U-Net+ResNet34"],
                  ["Label class",  "RGB(0, 110, 255) = rockfall"],
                  ["Threshold",    "sigmoid > 0.45 → rockfall"],
                  ["Alert status", result.alert?"🚨 ACTIVE":"✅ Clear"],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--bdr)",fontSize:11}}>
                    <span style={{color:"var(--txt3)"}}>{k}</span>
                    <span style={{fontWeight:500,color:k==="Alert status"&&result.alert?"var(--hi)":"var(--txt)"}}>{v}</span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
