"use client";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "@/lib/useWebSocket";
import { Card, CardLabel, Metric, LivePill, rc, rb, rd } from "@/components/ui/index";

interface Alert { id:number; level:string; msg:string; ts:string; resolved:boolean; score:number; }
let _id = 0;

const RECS: Record<string,string> = {
  LOW:"Continue routine monitoring.", MEDIUM:"Heightened monitoring. Notify authorities.",
  HIGH:"Issue public alert. Prepare evacuation.", CRITICAL:"Evacuate immediately. Alert NDRF.",
};

export default function AlertsPage() {
  const { connected, latest } = useWebSocket(60);
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [threshHigh, setHigh] = useState(0.65);
  const [threshCrit, setCrit] = useState(0.80);
  const [showCfg, setShowCfg] = useState(false);

  useEffect(() => {
    if (!latest) return;
    const s=latest.risk_score??0, l=(latest.risk_level??"LOW").toUpperCase();
    if (s < threshHigh) return;
    setAlerts(prev => {
      const recent=prev.filter(a=>!a.resolved).slice(-5);
      if (recent.some(a=>a.level===l)) return prev;
      const a:Alert={id:++_id,level:l,score:s,ts:latest.timestamp??new Date().toISOString(),resolved:false,
        msg:`${l} risk — ${Math.round(s*100)}%  vib=${Number(latest.vibration??0).toFixed(3)}g  disp=${Number(latest.displacement??0).toFixed(2)}mm`};
      return [a,...prev].slice(0,100);
    });
  }, [latest?.timestamp, threshHigh]);

  const resolve    = useCallback((id:number)=> setAlerts(p=>p.map(a=>a.id===id?{...a,resolved:true}:a)),[]);
  const resolveAll = useCallback(()         => setAlerts(p=>p.map(a=>({...a,resolved:true}))),[]);

  const active   = alerts.filter(a=>!a.resolved);
  const resolved = alerts.filter(a=> a.resolved);

  return (
    <div className="p-5" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:600,letterSpacing:"-.4px",color:"var(--txt)"}}>Alert Centre</h1>
          <p style={{fontSize:12,color:"var(--txt3)",marginTop:3}}>Auto-fires from live sensor stream when thresholds exceeded</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <LivePill connected={connected}/>
          <button onClick={()=>setShowCfg(v=>!v)}
            style={{padding:"5px 12px",borderRadius:8,background:"var(--bg2)",border:"1px solid var(--bdr2)",fontSize:11,color:"var(--txt2)",cursor:"pointer"}}>
            ⚙ Thresholds
          </button>
          {active.length>0&&<button onClick={resolveAll}
            style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",border:"1px solid var(--bdr)",fontSize:11,color:"var(--txt2)",cursor:"pointer"}}>
            ✓ Resolve all
          </button>}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <Metric label="Active"   value={active.length}                            accent="var(--hi)" color="var(--hi)"/>
        <Metric label="Resolved" value={resolved.length}                          accent="var(--lo)" color="var(--lo)"/>
        <Metric label="Critical" value={alerts.filter(a=>a.level==="CRITICAL").length} accent="var(--cr)" color="var(--cr)"/>
        <Metric label="High"     value={alerts.filter(a=>a.level==="HIGH").length}    accent="var(--me)" color="var(--me)"/>
      </div>

      {showCfg&&(
        <Card>
          <CardLabel text="Alert thresholds"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {[["High threshold",threshHigh,setHigh,.4,.8],["Critical threshold",threshCrit,setCrit,.6,1.0]].map(([l,v,fn,lo,hi])=>(
              <div key={String(l)}>
                <label style={{fontSize:11,color:"var(--txt2)",display:"block",marginBottom:8}}>{String(l)}</label>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="range" min={Number(lo)} max={Number(hi)} step={.05}
                    value={Number(v)}
                    onChange={e=>(fn as (n:number)=>void)(parseFloat(e.target.value))}
                    style={{flex:1,accentColor:"var(--acc)"}}/>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--acc2)",width:36,textAlign:"right"}}>
                    {Math.round(Number(v)*100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p style={{fontSize:10,color:"var(--txt3)",marginTop:10}}>
            Alerts fire automatically when WS risk score exceeds threshold.
          </p>
        </Card>
      )}

      <Card>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <CardLabel text={`🔴 Active alerts (${active.length})`}/>
        </div>
        {active.length===0 ? (
          <div style={{textAlign:"center",padding:"24px 0",color:"var(--txt3)"}}>
            <span style={{fontSize:32,display:"block",marginBottom:8}}>✅</span>
            <p style={{fontSize:12,color:"var(--lo)"}}>All clear — no active alerts</p>
            {!connected&&<p style={{fontSize:11,color:"var(--txt3)",marginTop:6}}>Backend offline — start uvicorn to enable live alerts</p>}
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {active.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:12,
                background:`color-mix(in srgb, ${rc(a.level)} 6%, var(--bg2))`,
                borderLeft:`3px solid ${rc(a.level)}`,border:`1px solid ${rd(a.level)}`,borderLeftWidth:3}}>
                <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",padding:"2px 8px",borderRadius:99,background:rb(a.level),color:rc(a.level),border:`1px solid ${rd(a.level)}`}}>
                      {a.level}
                    </span>
                    <span style={{fontSize:11,color:"var(--txt)"}}>{a.msg}</span>
                  </div>
                  <p style={{fontSize:10,color:"var(--txt3)"}}>{new Date(a.ts).toLocaleString()}</p>
                </div>
                <button onClick={()=>resolve(a.id)}
                  style={{padding:"4px 12px",borderRadius:7,background:"var(--bg3)",border:"1px solid var(--bdr)",fontSize:10,color:"var(--txt2)",cursor:"pointer",flexShrink:0}}>
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {alerts.length>0&&(
        <Card>
          <CardLabel text={`Incident log (${alerts.length} total)`}/>
          <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
            <thead>
              <tr style={{color:"var(--txt3)"}}>
                {["Time","Level","Score","Message","Status"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"4px 8px 10px",fontSize:10,textTransform:"uppercase",letterSpacing:".07em",fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0,12).map(a=>(
                <tr key={a.id} style={{borderTop:"1px solid var(--bdr)"}}>
                  <td style={{padding:"6px 8px",color:"var(--txt3)"}}>{new Date(a.ts).toLocaleTimeString()}</td>
                  <td style={{padding:"6px 8px",color:rc(a.level),fontWeight:600}}>{a.level}</td>
                  <td style={{padding:"6px 8px",fontFamily:"DM Mono,monospace",color:rc(a.level)}}>{Math.round(a.score*100)}%</td>
                  <td style={{padding:"6px 8px",color:"var(--txt2)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.msg}</td>
                  <td style={{padding:"6px 8px"}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,background:a.resolved?"var(--lo-bg)":"var(--hi-bg)",color:a.resolved?"var(--lo)":"var(--hi)"}}>
                      {a.resolved?"Resolved":"Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
