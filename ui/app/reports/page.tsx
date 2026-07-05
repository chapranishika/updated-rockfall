"use client";
import { useCallback } from "react";
import { useWebSocket } from "@/lib/useWebSocket";
import { Card, CardLabel, Metric, LivePill, rc } from "@/components/ui/index";

function download(content: string, filename: string, mime = "text/csv") {
  const a = document.createElement("a");
  a.href = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
  a.download = filename; a.click();
}

export default function ReportsPage() {
  const { connected, history, latest } = useWebSocket(200);
  const n = history.length;
  const avgScore = n ? history.reduce((s, r) => s + (r.risk_score ?? 0), 0) / n : 0;
  const alertCount = history.filter(r => r.alert).length;
  const dist: Record<string, number> = { LOW:0, MEDIUM:0, HIGH:0, CRITICAL:0 };
  history.forEach(r => { const l=(r.risk_level??"LOW").toUpperCase(); if(l in dist) dist[l]++; });
  const maxDist = Math.max(...Object.values(dist), 1);

  const dlLive = useCallback(() => {
    if (!n) return;
    const rows = history.map(r =>
      [r.timestamp, r.vibration, r.displacement, r.pore_pressure, r.strain,
       r.temperature, r.rainfall, r.risk_score, r.risk_level, r.alert?"YES":"NO"].join(",")
    );
    download(["timestamp,vibration,displacement,pore_pressure,strain,temperature,rainfall,risk_score,risk_level,alert",...rows].join("\n"),
      `rockfall_live_${new Date().toISOString().slice(0,10)}.csv`);
  }, [history]);

  const dlSummary = useCallback(() => {
    const rows = Object.entries(dist).map(([l, c]) =>
      `${l},${c},${n?Math.round(c/n*100):0}%`);
    download(["level,count,percentage",...rows].join("\n"),
      `rockfall_summary_${new Date().toISOString().slice(0,10)}.csv`);
  }, [dist, n]);

  const avgPct = Math.round(avgScore * 100);
  const avgC   = avgPct >= 65 ? "var(--hi)" : avgPct >= 40 ? "var(--me)" : "var(--lo)";

  return (
    <div className="p-5" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, letterSpacing:"-.4px", color:"var(--txt)" }}>Reports</h1>
          <p style={{ fontSize:12, color:"var(--txt3)", marginTop:3 }}>
            Session statistics · CSV export · risk distribution
          </p>
        </div>
        <LivePill connected={connected} />
      </div>

      {/* Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        <Metric label="Total readings" value={n.toLocaleString()} accent="var(--acc)" color="var(--acc2)" sub="~5s interval"/>
        <Metric label="Avg risk score" value={n ? `${avgPct}%` : "—"} accent={avgC} color={avgC} sub="Session mean"/>
        <Metric label="Alert events"   value={alertCount} accent="var(--me)" color="var(--me)" sub="score ≥ 65%"/>
        <Metric label="Session time"   value={`${Math.round(n*5/60)} min`} accent="var(--txt3)" color="var(--txt2)" sub="elapsed"/>
      </div>

      {/* Download cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { icon:"📡", title:"Live session CSV", sub:`${n} readings · all sensor columns`, fn:dlLive, disabled:n===0 },
          { icon:"📊", title:"Risk summary CSV", sub:"Distribution by risk level",         fn:dlSummary, disabled:n===0 },
        ].map(({ icon, title, sub, fn, disabled }) => (
          <Card key={title} style={{ cursor:"pointer" }} onClick={fn}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12 }}>
              <span style={{ fontSize:24, flexShrink:0 }}>{icon}</span>
              <div>
                <p style={{ fontSize:13, fontWeight:500, color:"var(--txt)", marginBottom:3 }}>{title}</p>
                <p style={{ fontSize:11, color:"var(--txt3)" }}>{sub}</p>
              </div>
            </div>
            <div style={{
              padding:"7px 14px", borderRadius:8, textAlign:"center",
              background: disabled ? "var(--bg3)" : "var(--acc-bg)",
              border:`1px solid ${disabled ? "var(--bdr)" : "#4f8ef730"}`,
              fontSize:11, fontWeight:500,
              color: disabled ? "var(--txt3)" : "var(--acc2)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}>
              {disabled ? "No data yet" : "⬇ Download CSV"}
            </div>
          </Card>
        ))}
      </div>

      {/* Distribution chart */}
      <Card>
        <CardLabel text="Risk level distribution" />
        {n === 0 ? (
          <div style={{ textAlign:"center", padding:"28px 0", color:"var(--txt3)" }}>
            <span style={{ fontSize:28, display:"block", marginBottom:8 }}>📡</span>
            <p style={{ fontSize:12 }}>Collecting live data…</p>
            {!connected && <p style={{ fontSize:11, marginTop:6 }}>Start the backend to see real-time data</p>}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(dist).map(([level, count]) => (
              <div key={level} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:68, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", color:rc(level) }}>
                  {level}
                </div>
                <div style={{ flex:1, height:20, background:"var(--bg4)", borderRadius:5, overflow:"hidden" }}>
                  <div style={{
                    height:"100%", borderRadius:5,
                    background: rc(level) + "aa",
                    width:`${Math.round(count/maxDist*100)}%`,
                    transition:"width .7s cubic-bezier(.4,0,.2,1)",
                    display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:6,
                    fontSize:10, fontWeight:700, color:"#fff",
                  }}>
                    {count > 2 ? count : ""}
                  </div>
                </div>
                <div style={{ width:36, fontSize:10, color:"var(--txt3)", textAlign:"right" }}>
                  {Math.round(count/n*100)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Stats table */}
      <Card>
        <CardLabel text="Session statistics" />
        <table style={{ width:"100%", fontSize:11, borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ color:"var(--txt3)" }}>
              {["Metric","Value","Notes"].map(h=>(
                <th key={h} style={{ textAlign:"left", padding:"4px 8px 10px", fontSize:10, textTransform:"uppercase", letterSpacing:".07em", fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Live WS readings",    n.toLocaleString(),                           "~5s sampling interval"],
              ["Average risk score",  n?`${avgPct}%`:"—",                          "Session mean"],
              ["Alert events fired",  alertCount,                                    "Readings where score ≥ 65%"],
              ["LOW readings",        dist.LOW,                                      `${n?Math.round(dist.LOW/n*100):0}% of session`],
              ["HIGH + CRITICAL",     dist.HIGH+dist.CRITICAL,                       `${n?Math.round((dist.HIGH+dist.CRITICAL)/n*100):0}% of session`],
              ["WebSocket status",    connected?"Connected":"Offline",               "Auto-reconnects on disconnect"],
              ["Latest risk level",   latest?.risk_level??"—",                      `Score: ${Math.round((latest?.risk_score??0)*100)}%`],
            ].map(([m,v,note])=>(
              <tr key={String(m)} style={{ borderTop:"1px solid var(--bdr)" }}>
                <td style={{ padding:"6px 8px", color:"var(--txt)" }}>{String(m)}</td>
                <td style={{ padding:"6px 8px", fontWeight:600, color:"var(--acc2)", fontFamily:"DM Mono,monospace" }}>{String(v)}</td>
                <td style={{ padding:"6px 8px", color:"var(--txt3)" }}>{String(note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
