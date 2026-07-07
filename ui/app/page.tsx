"use client";
import { useEffect, useState, useCallback } from "react";
import { api, FusionResult } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";
import { Card, CardLabel, Metric, RiskGauge, RiskBadge, LivePill, RiskBar, Sparkline, RECS, rc } from "@/components/ui/index";

const SENSORS = [
  {k:"vibration",    l:"Vibration",     u:"g",   c:"#4f8ef7"},
  {k:"displacement", l:"Displacement",  u:"mm",  c:"#ef4444"},
  {k:"pore_pressure",l:"Pore pressure", u:"kPa", c:"#a855f7"},
  {k:"strain",       l:"Strain",        u:"με",  c:"#f59e0b"},
  {k:"temperature",  l:"Temperature",   u:"°C",  c:"#22c55e"},
  {k:"rainfall",     l:"Rainfall",      u:"mm",  c:"#06b6d4"},
];

function TrendChart({ data }: { data: number[] }) {
  if (data.length < 2) return <div style={{ height: 72 }} />;
  return (
    <svg viewBox={`0 0 ${data.length - 1} 100`} width="100%" height={72} preserveAspectRatio="none">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f8ef7" stopOpacity={.3} />
          <stop offset="100%" stopColor="#4f8ef7" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Warning lines */}
      <line x1={0} y1={35} x2={data.length - 1} y2={35} stroke="#f59e0b33" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={0} y1={20} x2={data.length - 1} y2={20} stroke="#ef444433" strokeWidth={1} strokeDasharray="4 3" />
      <polygon
        points={`0,100 ${data.map((v, i) => `${i},${100 - v * 90 - 5}`).join(" ")} ${data.length - 1},100`}
        fill="url(#tg)" />
      <polyline
        points={data.map((v, i) => `${i},${100 - v * 90 - 5}`).join(" ")}
        fill="none" stroke="#4f8ef7" strokeWidth={2} />
    </svg>
  );
}

export default function Dashboard() {
  const ws = useWebSocket(120);
  const [demo, setDemo]     = useState<FusionResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setDemo(await api.demo()); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const score = demo?.final_risk_score ?? ws.latest?.risk_score ?? 0;
  const level = demo?.risk_level ?? ws.latest?.risk_level ?? "LOW";
  const c     = rc(level);
  const pct   = Math.round(score * 100);
  const trend = ws.history.map(r => r.risk_score ?? 0);

  return (
    <div className="p-5" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, letterSpacing:"-.4px", color:"var(--txt)" }}>
            Live Monitoring
          </h1>
          <p style={{ fontSize:12, color:"var(--txt3)", marginTop:3 }}>
            Real-time multi-modal geophysical risk assessment
          </p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <LivePill connected={ws.connected} />
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:99, background:"var(--acc-bg)", color:"var(--acc2)", border:"1px solid #4f8ef730", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>
            {demo?.mode ?? "—"}
          </span>
          <button onClick={refresh}
            style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:12, color:"var(--txt2)" }}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:12 }}>
        {/* Gauge */}
        <Card style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:20 }}>
          <CardLabel text="Risk assessment" />
          <RiskGauge score={score} level={level} />
          <p style={{ fontSize:11, color:"var(--txt3)", textAlign:"center", lineHeight:1.5, maxWidth:160 }}>
            {RECS[level]}
          </p>
        </Card>

        {/* Metrics */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            <Metric label="Final score"   value={`${pct}%`}      accent={c}          color={c} />
            <Metric label="Sensor score"  value={`${Math.round((demo?.explainability?.sensor_score ?? 0)*100)}%`} accent="var(--acc)" />
            <Metric label="Confidence"    value={`${Math.round((demo?.confidence ?? 0)*100)}%`} accent="var(--lo)" color="var(--lo)" />
            <Metric label="Alert"         value={demo?.alert ? "Active" : "Clear"} accent={demo?.alert ? "var(--hi)" : "var(--lo)"} color={demo?.alert ? "var(--hi)" : "var(--lo)"} />
          </div>
          <Card>
            <CardLabel text="Risk trend — last 60 readings" />
            <TrendChart data={trend} />
          </Card>
        </div>
      </div>

      {/* Telemetry */}
      <Card>
        <CardLabel text="Live telemetry" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
          {SENSORS.map(s => {
            const vals = ws.history.map(r => Number((r as Record<string,unknown>)[s.k] ?? 0));
            const cur  = vals[vals.length - 1] ?? 0;
            return (
              <div key={s.k} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:10 }}>
                <p style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".1em", color:"var(--txt3)", fontWeight:600, marginBottom:4 }}>{s.l}</p>
                <p style={{ fontSize:17, fontWeight:700, color:s.c, letterSpacing:"-.4px" }}>
                  {cur.toFixed(2)}
                  <span style={{ fontSize:9, color:"var(--txt3)", marginLeft:2, fontWeight:400 }}>{s.u}</span>
                </p>
                <Sparkline data={vals.slice(-24)} color={s.c} height={28} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Factors */}
      {demo?.explainability?.factors && (
        <Card>
          <CardLabel text="Contributing factors" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {Object.entries(demo.explainability.factors).map(([k, v]) => (
              <div key={k} style={{ padding:"8px 12px", background:"var(--bg2)", borderRadius:10, border:"1px solid var(--bdr)" }}>
                <p style={{ fontSize:10, fontWeight:600, color:"var(--acc2)", marginBottom:3 }}>{k}</p>
                <p style={{ fontSize:11, color:"var(--txt2)", lineHeight:1.5 }}>{String(v)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
