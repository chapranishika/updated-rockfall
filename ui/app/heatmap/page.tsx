"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, FusionResult, rc, rb, rd, RECS } from "@/lib/api";
import { Card, CardLabel, CardSm, LivePill, RiskBar, RiskBadge, DropZone } from "@/components/ui/index";

const ROWS=6, COLS=8;
function buildGrid(base:number, seed:number) {
  return Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
    const d=Math.sqrt((c-COLS+1)**2+r**2), sp=Math.max(0,1-d/(COLS*.9));
    const n=((Math.sin(seed+r*7+c*13)+1)/2)*.18;
    return Math.min(1, base*.55+sp*.36+n);
  }));
}
function cellBg(s:number){return s>=.8?"rgba(255,23,68,.22)":s>=.65?"rgba(239,68,68,.18)":s>=.4?"rgba(245,158,11,.16)":"rgba(34,197,94,.10)";}
function cellBdr(s:number){return s>=.8?"rgba(255,23,68,.5)":s>=.65?"rgba(239,68,68,.4)":s>=.4?"rgba(245,158,11,.4)":"rgba(34,197,94,.28)";}
function cLevel(s:number){return s>=.8?"CRITICAL":s>=.65?"HIGH":s>=.4?"MEDIUM":"LOW";}

export default function HeatmapPage() {
  const [vib, setVib]   = useState(0.4);
  const [dis, setDis]   = useState(2.0);
  const [pore,setPore]  = useState(0.8);
  const [str, setStr]   = useState(0.5);
  const [seed, setSeed] = useState(0);
  const [hov, setHov]   = useState<[number,number]|null>(null);
  const [file,setFile]  = useState<File|null>(null);
  const [prev,setPrev]  = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [result,setResult]   = useState<FusionResult|null>(null);
  const [error,setError]     = useState("");

  useEffect(() => {
    const id = setInterval(() => setSeed(Math.floor(Date.now()/8000)), 8000);
    return () => clearInterval(id);
  }, []);

  const grid  = buildGrid(Math.min(.95, vib*.15+.25), seed);
  const counts= grid.flat().reduce((a,s)=>{const l=cLevel(s);a[l]=(a[l]??0)+1;return a;},{} as Record<string,number>);

  const handleFile = (f:File) => {
    setFile(f); setResult(null); setError("");
    const rd2=new FileReader(); rd2.onload=e=>setPrev(e.target?.result as string); rd2.readAsDataURL(f);
  };

  const analyse = useCallback(async () => {
    setLoading(true); setError("");
    try {
      setResult(await api.predictFinal({vibration:vib,displacement:dis,pore_pressure:pore,strain:str,temperature:20,rainfall:0}, file??undefined));
    } catch(e:unknown) { setError(e instanceof Error?e.message:"Failed"); }
    finally { setLoading(false); }
  }, [vib,dis,pore,str,file]);

  const score= result?.final_risk_score??0;
  const level= result?.risk_level??"LOW";
  const c    = rc(level);

  return (
    <div className="p-5" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:"-.4px",color:"var(--txt)"}}>Heatmap</h1>
          <p style={{fontSize:12,color:"var(--txt3)",marginTop:3}}>Spatial risk grid · Multi-modal fusion analysis</p>
        </div>
        <span style={{fontSize:10,color:"var(--txt3)"}}>Grid refreshes every 8s</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Grid side */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <CardLabel text="Slope risk grid" />
              <span style={{fontSize:10,color:"var(--txt3)"}}>W ←→ E</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${COLS},1fr)`,gap:2,marginBottom:10}}>
              {grid.map((row,r)=>row.map((s,c2)=>{
                const isH=hov?.[0]===r&&hov?.[1]===c2;
                return (
                  <div key={`${r}-${c2}`}
                    onMouseEnter={()=>setHov([r,c2])} onMouseLeave={()=>setHov(null)}
                    title={`Zone(${r+1},${c2+1}): ${cLevel(s)} — ${Math.round(s*100)}%`}
                    style={{
                      aspectRatio:"1",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:8,fontWeight:700,cursor:"default",
                      background:cellBg(s),border:`1px solid ${cellBdr(s)}`,color:rc(cLevel(s)),
                      transform:isH?"scale(1.15)":"scale(1)",zIndex:isH?5:1,
                      transition:"transform .1s",position:"relative",
                    }}>
                    {Math.round(s*100)}
                  </div>
                );
              }))}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {[["#22c55e28","#22c55e45","Low"],["#f59e0b22","#f59e0b45","Med"],["#ef444422","#ef444445","High"],["#ff174422","#ff174445","Crit"]].map(([bg,bdr,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--txt3)"}}>
                  <span style={{width:10,height:10,borderRadius:3,background:bg,border:`1px solid ${bdr}`,display:"inline-block"}}/>
                  {l}
                </span>
              ))}
            </div>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[["lo","LOW","var(--lo)"],["me","MEDIUM","var(--me)"],["hi","HIGH","var(--hi)"],["cr","CRITICAL","var(--cr)"]].map(([k,lv,clr])=>(
              <CardSm key={k} style={{textAlign:"center"}}>
                <p style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:clr,fontWeight:600,marginBottom:4}}>{lv}</p>
                <p style={{fontSize:20,fontWeight:700,color:clr}}>{counts[lv]??0}</p>
              </CardSm>
            ))}
          </div>
        </div>

        {/* Inputs side */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card>
            <CardLabel text="Sensor inputs" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["Vibration (g)",vib,setVib,.1],["Displacement (mm)",dis,setDis,.5],["Pore pressure (kPa)",pore,setPore,.1],["Strain (με)",str,setStr,.05]].map(([l,v,fn,step])=>(
                <div key={String(l)}>
                  <label style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",color:"var(--txt3)",display:"block",marginBottom:4}}>{String(l)}</label>
                  <input type="number" value={Number(v)} step={Number(step)} min={0}
                    onChange={e=>(fn as (n:number)=>void)(parseFloat(e.target.value)||0)}
                    style={{width:"100%",background:"var(--bg3)",border:"1px solid var(--bdr2)",borderRadius:8,padding:"7px 10px",fontSize:12,color:"var(--txt)",fontFamily:"inherit",outline:"none"}}/>
                </div>
              ))}
            </div>
            <DropZone onFile={handleFile} preview={prev} fileName={file?.name} label="Drop drone image · click to upload" sub="PNG · JPEG · TIFF · optional" />
            <button onClick={analyse} disabled={loading}
              style={{width:"100%",marginTop:10,padding:"10px",background:"var(--acc)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?.6:1}}>
              {loading ? "⚙️ Analysing…" : "⚡ Run fusion analysis"}
            </button>
            {error && <p style={{fontSize:11,color:"var(--hi)",marginTop:6}}>{error}</p>}
          </Card>

          {result && (
            <Card>
              <CardLabel text="Fusion result" />
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:28,fontWeight:700,letterSpacing:"-1px",color:c}}>{Math.round(score*100)}%</span>
                <span style={{fontSize:10,color:"var(--txt3)"}}>conf {Math.round((result.confidence??0)*100)}%</span>
              </div>
              <RiskBar score={score} level={level} />
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <RiskBadge level={level} />
                <span style={{fontSize:10,color:"var(--txt3)"}}>mode: {result.mode}</span>
                {result.alert && <span style={{fontSize:10,fontWeight:700,color:"var(--hi)"}}>🚨 Alert</span>}
              </div>
              {result.image_overlay_b64 && (
                <div style={{marginTop:12,borderRadius:8,overflow:"hidden",border:"1px solid var(--bdr)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"var(--bg2)",fontSize:10,color:"var(--txt3)"}}>
                    <span>Segmentation overlay</span>
                    <span style={{color:"var(--hi)"}}>■ rockfall</span>
                  </div>
                  <img src={`data:image/png;base64,${result.image_overlay_b64}`} alt="overlay" style={{width:"100%",maxHeight:140,objectFit:"cover"}}/>
                </div>
              )}
              <div style={{marginTop:10,padding:10,background:"var(--bg2)",borderRadius:10,fontSize:11,color:"var(--txt2)",lineHeight:1.5}}>
                {RECS[level]}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
