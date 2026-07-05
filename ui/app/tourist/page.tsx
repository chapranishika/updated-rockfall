"use client";
import { useWebSocket } from "@/lib/useWebSocket";
import { LivePill, RiskBar, rc, rb, rd, TOURIST_RECS } from "@/components/ui/index";

const SENSORS = [
  {k:"vibration",    l:"Vibration",     c:"#4f8ef7", max:1.5},
  {k:"displacement", l:"Displacement",  c:"#ef4444", max:10},
  {k:"pore_pressure",l:"Pore pressure", c:"#a855f7", max:4},
  {k:"strain",       l:"Strain",        c:"#f59e0b", max:2},
];

const TOURIST_GUIDES: Record<string, React.ReactNode> = {
  LOW:      <><div>✓ All hiking trails open</div><div>✓ Viewing platforms accessible</div><div>✓ All visitor zones operational</div></>,
  MEDIUM:   <><div>⚠ Stay on marked trails only</div><div>⚠ Avoid cliff edges &amp; unstable terrain</div><div>✗ Rock climbing suspended</div></>,
  HIGH:     <><div>✗ Most trails closed</div><div>✗ Viewing platforms closed</div><div>✓ Main road access only</div></>,
  CRITICAL: <><div style={{color:"#ff1744",fontWeight:600}}>✗ ALL ZONES CLOSED</div><div style={{color:"#ff1744"}}>✗ Immediate evacuation required</div><div>✓ Follow emergency staff</div></>,
};

const TOURIST_EXPLAIN: Record<string, string> = {
  LOW:      "Our AI monitors 6 geophysical sensors around the clock. Current readings are within normal range. No unusual ground movement or vibration detected.",
  MEDIUM:   "Slightly elevated vibration and displacement readings detected. Our team is monitoring closely. Reduced activity is recommended near slopes.",
  HIGH:     "Significant sensor anomalies detected. Ground movement and vibration levels are elevated. Emergency protocols are active.",
  CRITICAL: "All sensors show extreme readings. Immediate evacuation is required. Emergency services have been notified.",
};

export default function TouristPage() {
  const { connected, latest } = useWebSocket(60);
  const score = latest?.risk_score ?? 0;
  const level = (latest?.risk_level ?? "LOW").toUpperCase();
  const pct   = Math.round(score * 100);
  const c     = rc(level);

  return (
    <div className="p-5" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, letterSpacing:"-.4px", color:"var(--txt)" }}>Safety Status</h1>
          <p style={{ fontSize:12, color:"var(--txt3)", marginTop:3 }}>Current rockfall risk for visitors and hikers</p>
        </div>
        <LivePill connected={connected} />
      </div>

      {/* Hero risk card */}
      <div style={{
        background:`linear-gradient(135deg, var(--bg2), var(--bg3))`,
        border:`1px solid var(--bdr2)`, borderRadius:20, padding:28,
        textAlign:"center", position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:c, borderRadius:"20px 20px 0 0" }} />
        <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".12em", color:"var(--txt3)", marginBottom:14 }}>
          AREA RISK LEVEL
        </p>
        <p style={{ fontSize:64, fontWeight:700, letterSpacing:"-3px", lineHeight:1, color:c }}>{pct}%</p>
        <p style={{ fontSize:15, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em", color:c, margin:"10px 0 6px" }}>
          {level} RISK
        </p>
        <p style={{ fontSize:13, color:"var(--txt2)", lineHeight:1.6, maxWidth:320, margin:"0 auto 16px" }}>
          {TOURIST_RECS[level]}
        </p>
        <RiskBar score={score} level={level} />
        <span style={{
          display:"inline-block", marginTop:12, padding:"7px 22px", borderRadius:99,
          background:rb(level), color:c, border:`1px solid ${rd(level)}`,
          fontSize:12, fontWeight:600,
        }}>
          {{LOW:"Proceed with normal caution",MEDIUM:"Caution recommended",HIGH:"Avoid hazardous zones",CRITICAL:"EVACUATE NOW"}[level]}
        </span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:14, padding:16 }}>
          <p style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"var(--txt3)", marginBottom:10 }}>What does this mean?</p>
          <p style={{ fontSize:12, color:"var(--txt2)", lineHeight:1.7 }}>{TOURIST_EXPLAIN[level]}</p>
        </div>
        <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:14, padding:16 }}>
          <p style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"var(--txt3)", marginBottom:10 }}>Safety guidelines</p>
          <div style={{ fontSize:12, color:"var(--txt2)", lineHeight:1.9 }}>{TOURIST_GUIDES[level]}</div>
          <p style={{ fontSize:10, color:"var(--txt3)", marginTop:10 }}>Last updated: just now</p>
        </div>
      </div>

      <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:14, padding:16 }}>
        <p style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"var(--txt3)", marginBottom:12 }}>Sensor readings — simplified</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {SENSORS.map(s => {
            const v = Number((latest as Record<string,unknown> | null)?.[s.k] ?? 0);
            const fill = Math.min(100, (v / s.max) * 100);
            const st = fill >= 75 ? {l:"High",c:"#ef4444"} : fill >= 40 ? {l:"Elevated",c:"#f59e0b"} : {l:"Normal",c:"#22c55e"};
            return (
              <div key={s.k} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:90, fontSize:11, color:"var(--txt2)" }}>{s.l}</div>
                <div style={{ flex:1, height:8, background:"var(--bg4)", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:99, background:st.c, width:`${fill}%`, transition:"width .5s" }} />
                </div>
                <div style={{ width:52, fontSize:10, fontWeight:700, color:st.c, textAlign:"right" }}>{st.l}</div>
              </div>
            );
          })}
        </div>
      </div>

      {!connected && (
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:14, textAlign:"center" }}>
          <p style={{ fontSize:12, color:"var(--txt3)" }}>
            🔌 Live data unavailable — start the backend with{" "}
            <code style={{ fontFamily:"DM Mono,monospace", fontSize:11, background:"var(--bg3)", padding:"1px 6px", borderRadius:4 }}>
              uvicorn backend.main:app --port 8000
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
