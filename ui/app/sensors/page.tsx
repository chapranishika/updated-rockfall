"use client";
import { useState, useRef, useCallback } from "react";
import { useWebSocket, SimReading } from "@/lib/useWebSocket";
import { Card, CardLabel, LivePill, Sparkline, rc } from "@/components/ui/index";

const SENSORS = [
  {k:"vibration",    l:"Vibration",     u:"g",   c:"#4f8ef7", w:.6,  cr:1.0},
  {k:"displacement", l:"Displacement",  u:"mm",  c:"#ef4444", w:5.0, cr:10.0},
  {k:"pore_pressure",l:"Pore pressure", u:"kPa", c:"#a855f7", w:2.0, cr:3.5},
  {k:"strain",       l:"Strain",        u:"με",  c:"#f59e0b", w:.9,  cr:1.5},
  {k:"temperature",  l:"Temperature",   u:"°C",  c:"#22c55e", w:38,  cr:45},
  {k:"rainfall",     l:"Rainfall",      u:"mm",  c:"#06b6d4", w:30,  cr:60},
];

function status(v:number, w:number, cr:number) {
  if (v >= cr) return {l:"CRITICAL", c:"#ff1744"};
  if (v >= w)  return {l:"WARNING",  c:"#f59e0b"};
  return {l:"NORMAL", c:"#22c55e"};
}

export default function SensorsPage() {
  const { connected, latest, history, error } = useWebSocket(120);
  const [sel, setSel] = useState(0);
  const cvRef = useRef<HTMLCanvasElement>(null);

  const drawDetail = useCallback(() => {
    const cv = cvRef.current; if (!cv || history.length < 2) return;
    const s   = SENSORS[sel];
    const vals= history.map(r => Number((r as Record<string,unknown>)[s.k] ?? 0)).slice(-60);
    const ctx = cv.getContext("2d")!;
    cv.width  = cv.offsetWidth || 400; cv.height = 100;
    ctx.clearRect(0,0,cv.width,cv.height);
    const W=cv.width, H=cv.height, mx=Math.max(...vals, s.cr*1.1);
    const yFor = (v:number) => H - (v/mx)*H*.92 - H*.04;
    [[s.w,"#f59e0b"],[s.cr,"#ef4444"]].forEach(([th,col]) => {
      const y=yFor(th as number);
      ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y);
      ctx.strokeStyle=(col as string)+"55"; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    });
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,s.c+"33"); grad.addColorStop(1,s.c+"00");
    ctx.beginPath();
    vals.forEach((v,i) => { const x=i/(vals.length-1)*W, y=yFor(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.strokeStyle=s.c; ctx.lineWidth=2; ctx.stroke();
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  }, [history, sel]);

  // Draw on each render
  setTimeout(drawDetail, 0);

  return (
    <div className="p-5" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, letterSpacing:"-.4px", color:"var(--txt)" }}>Sensors</h1>
          <p style={{ fontSize:12, color:"var(--txt3)", marginTop:3 }}>Real-time geophysical telemetry · WebSocket stream</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <LivePill connected={connected} />
          {error && <span style={{ fontSize:11, color:"var(--me)" }}>{error}</span>}
          {latest?.event_active && <span style={{ fontSize:10, padding:"3px 10px", borderRadius:99, background:"var(--hi-bg)", color:"var(--hi)", border:"1px solid var(--hi-bdr)", fontWeight:600 }}>🚨 Event active</span>}
        </div>
      </div>

      {/* Sensor strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
        {SENSORS.map((s,i) => {
          const v = Number((latest as Record<string,unknown> | null)?.[s.k] ?? 0);
          const st= status(v,s.w,s.cr);
          const on= sel===i;
          const vals = history.map(r => Number((r as Record<string,unknown>)[s.k] ?? 0)).slice(-20);
          return (
            <div key={s.k} onClick={() => setSel(i)}
              style={{
                background: on ? "var(--bg2)" : "var(--bg1)",
                border: `1px solid ${on ? s.c+"55" : "var(--bdr)"}`,
                borderRadius:12, padding:12, cursor:"pointer", transition:"all .15s",
                position:"relative", overflow:"hidden",
              }}>
              {on && <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:s.c }} />}
              <p style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".1em", color:"var(--txt3)", fontWeight:600, marginBottom:4 }}>{s.l}</p>
              <p style={{ fontSize:20, fontWeight:700, color:s.c, letterSpacing:"-.4px" }}>
                {v.toFixed(2)}
                <span style={{ fontSize:9, color:"var(--txt3)", marginLeft:3, fontWeight:400 }}>{s.u}</span>
              </p>
              <p style={{ fontSize:9, fontWeight:700, color:st.c, marginTop:3 }}>{st.l}</p>
              <Sparkline data={vals} color={s.c} height={24} />
            </div>
          );
        })}
      </div>

      {/* Detail chart */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <CardLabel text={`${SENSORS[sel].l} — last ${Math.min(60,history.length)} readings`} />
          <div style={{ display:"flex", gap:12, fontSize:10, color:"var(--txt3)" }}>
            <span>⚠ warn <strong style={{ color:"#f59e0b" }}>{SENSORS[sel].w}</strong> {SENSORS[sel].u}</span>
            <span style={{ color:"#ef4444" }}>🔴 crit <strong>{SENSORS[sel].cr}</strong> {SENSORS[sel].u}</span>
          </div>
        </div>
        {history.length < 2 ? (
          <div style={{ height:100, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--txt3)", fontSize:12 }}>
            Connecting to sensor stream…
          </div>
        ) : (
          <canvas ref={cvRef} style={{ width:"100%", display:"block" }} height={100} />
        )}
      </Card>

      {/* Table */}
      <Card>
        <CardLabel text="Latest readings" />
        <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ color:"var(--txt3)" }}>
              {["Sensor","Current","Unit","Warn","Crit","Status"].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"4px 8px 10px", fontSize:10, textTransform:"uppercase", letterSpacing:".07em", fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SENSORS.map(s => {
              const v = Number((latest as Record<string,unknown> | null)?.[s.k] ?? 0);
              const st= status(v,s.w,s.cr);
              return (
                <tr key={s.k} style={{ borderTop:"1px solid var(--bdr)" }}>
                  <td style={{ padding:"6px 8px", color:s.c, fontWeight:500 }}>{s.l}</td>
                  <td style={{ padding:"6px 8px", fontFamily:"DM Mono,monospace", color:"var(--txt)" }}>{v.toFixed(4)}</td>
                  <td style={{ padding:"6px 8px", color:"var(--txt3)" }}>{s.u}</td>
                  <td style={{ padding:"6px 8px", color:"var(--txt3)" }}>{s.w}</td>
                  <td style={{ padding:"6px 8px", color:"var(--txt3)" }}>{s.cr}</td>
                  <td style={{ padding:"6px 8px" }}>
                    <span style={{ fontSize:9, fontWeight:700, color:st.c }}>{st.l}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
