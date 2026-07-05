"use client";
import React from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
export const RISK_COLORS: Record<string,string> = {
  LOW:"#22c55e", MEDIUM:"#f59e0b", HIGH:"#ef4444", CRITICAL:"#ff1744",
};
export const RISK_BGS: Record<string,string> = {
  LOW:"#22c55e14", MEDIUM:"#f59e0b14", HIGH:"#ef444414", CRITICAL:"#ff174414",
};
export const RISK_BDRS: Record<string,string> = {
  LOW:"#22c55e30", MEDIUM:"#f59e0b30", HIGH:"#ef444430", CRITICAL:"#ff174430",
};
export const RECS: Record<string,string> = {
  LOW:"Continue routine monitoring. Conditions stable.",
  MEDIUM:"Heightened monitoring. Notify local authorities.",
  HIGH:"Issue public alert. Increase monitoring. Prepare evacuation.",
  CRITICAL:"Evacuate immediately. Alert NDRF. Close all access roads.",
};
export const TOURIST_RECS: Record<string,string> = {
  LOW:"Conditions are stable. Normal hiking and tourism activities may proceed.",
  MEDIUM:"Elevated risk detected. Proceed with extra caution. Avoid cliff edges.",
  HIGH:"High rockfall risk. Non-essential activities discouraged.",
  CRITICAL:"CRITICAL RISK. All tourism activities suspended. Evacuate immediately.",
};

export function rc(l: string) { return RISK_COLORS[l?.toUpperCase()] ?? "#5a6480"; }
export function rb(l: string) { return RISK_BGS[l?.toUpperCase()]    ?? "#1a1f32"; }
export function rd(l: string) { return RISK_BDRS[l?.toUpperCase()]   ?? "#ffffff18"; }

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className="", style, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div className={className} style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:14, padding:16, ...style }} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardSm({ children, className="", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:12, ...style }}>
      {children}
    </div>
  );
}

export function CardLabel({ text }: { text: string }) {
  return (
    <p style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"var(--txt3)", marginBottom:12 }}>
      {text}
    </p>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
export function Metric({
  label, value, sub, accent = "var(--acc)", color,
}: { label:string; value:string|number; sub?:string; accent?:string; color?:string }) {
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12,
      padding:"14px 16px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:accent, opacity:.6, borderRadius:"2px 2px 0 0" }} />
      <p style={{ fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", color:"var(--txt3)", marginBottom:6 }}>
        {label}
      </p>
      <p style={{ fontSize:22, fontWeight:600, letterSpacing:"-.5px", color: color ?? accent }}>
        {value}
      </p>
      {sub && <p style={{ fontSize:11, color:"var(--txt3)", marginTop:3 }}>{sub}</p>}
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────
export function RiskBadge({ level, size="sm" }: { level:string; size?:"sm"|"md" }) {
  const l = level?.toUpperCase() ?? "LOW";
  const p = size === "md" ? "6px 16px" : "3px 10px";
  const fs = size === "md" ? 11 : 10;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding: p, borderRadius:99, fontSize: fs, fontWeight:600,
      textTransform:"uppercase", letterSpacing:".06em", border:"1px solid",
      background: rb(l), color: rc(l), borderColor: rd(l),
    }}>{l} RISK</span>
  );
}

// ── Live pill ─────────────────────────────────────────────────────────────────
export function LivePill({ connected=true }: { connected?: boolean }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      background:"var(--lo-bg)", border:"1px solid var(--lo-bdr)",
      borderRadius:99, padding:"4px 10px", fontSize:10, fontWeight:600,
      color:"var(--lo)", textTransform:"uppercase", letterSpacing:".07em",
    }}>
      <span style={{
        width:5, height:5, borderRadius:"50%", background: connected ? "var(--lo)" : "#5a6480",
        animation: connected ? "pulse-live 1.8s ease-in-out infinite" : "none",
      }} />
      {connected ? "Live" : "Offline"}
    </span>
  );
}

// ── Risk gauge (SVG arc) ──────────────────────────────────────────────────────
export function RiskGauge({ score, level }: { score:number; level:string }) {
  const pct  = Math.round(score * 100);
  const c    = rc(level);
  const cx=100, cy=100, r=74;
  const P = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r*Math.cos(rad), y: cy + r*Math.sin(rad) };
  };
  const arc = (s: number, e: number) => {
    const st=P(s), en=P(e), lg = e-s>180?1:0;
    return `M ${st.x} ${st.y} A ${r} ${r} 0 ${lg} 1 ${en.x} ${en.y}`;
  };
  const needleDeg = -130 + pct*2.6;
  const ndl = P(needleDeg);
  const totalArcLen = 232;
  const dashOffset  = Math.max(0, totalArcLen - totalArcLen*score);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <svg viewBox="0 0 200 150" width="200">
        {/* Track */}
        <path d={arc(-130,130)} fill="none" stroke="var(--bg4)" strokeWidth={13} strokeLinecap="round"/>
        {/* Gradient zones */}
        <path d={arc(-130,-130+40*2.6)} fill="none" stroke="#22c55e22" strokeWidth={13} strokeLinecap="round"/>
        <path d={arc(-130+40*2.6,-130+65*2.6)} fill="none" stroke="#f59e0b22" strokeWidth={13} strokeLinecap="round"/>
        <path d={arc(-130+65*2.6,-130+80*2.6)} fill="none" stroke="#ef444422" strokeWidth={13} strokeLinecap="round"/>
        <path d={arc(-130+80*2.6,130)} fill="none" stroke="#ff174422" strokeWidth={13} strokeLinecap="round"/>
        {/* Active fill */}
        <path d={arc(-130,130)} fill="none" stroke={c} strokeWidth={13} strokeLinecap="round"
          strokeDasharray={totalArcLen} strokeDashoffset={dashOffset}
          style={{ filter:`drop-shadow(0 0 8px ${c}55)`, transition:"stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)" }}/>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={ndl.x} y2={ndl.y} stroke={c} strokeWidth={2.5} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={6} fill={c}/>
        <circle cx={cx} cy={cy} r={3} fill="var(--bg1)"/>
        {/* Labels */}
        <text x={cx} y={cy+22} textAnchor="middle" fontSize={26} fontWeight={600}
          fill={c} fontFamily="DM Sans" style={{ letterSpacing:"-1px" }}>
          {pct}%
        </text>
        <text x={cx} y={cy+38} textAnchor="middle" fontSize={9} fill="var(--txt3)" fontFamily="DM Sans">
          RISK SCORE
        </text>
      </svg>
      <RiskBadge level={level} size="md" />
    </div>
  );
}

// ── Risk bar ──────────────────────────────────────────────────────────────────
export function RiskBar({ score, level }: { score:number; level:string }) {
  return (
    <div>
      <div style={{ height:6, borderRadius:99, background:"var(--bg4)", overflow:"hidden", margin:"6px 0" }}>
        <div style={{
          height:"100%", borderRadius:99, background:rc(level),
          width:`${Math.round(score*100)}%`,
          transition:"width .7s cubic-bezier(.4,0,.2,1)",
        }}/>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
export function Sparkline({ data, color, height=40 }: { data:number[]; color:string; height?:number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W=100, H=height;
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*W;
    const y = H - ((v-min)/range)*(H*.85) - H*.05;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={.3}/>
          <stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#sg${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}/>
    </svg>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
export function DropZone({
  onFile, label="Drop image here", sub="PNG · JPEG · TIFF", fileName, preview,
}: {
  onFile: (f:File)=>void; label?:string; sub?:string;
  fileName?:string; preview?: string|null;
}) {
  const [drag, setDrag] = React.useState(false);
  return (
    <div
      onClick={() => document.getElementById("dz-input")?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0]; if(f) onFile(f);
      }}
      style={{
        border: `1.5px dashed ${drag ? "var(--acc)" : "var(--bdr2)"}`,
        borderRadius:12, padding:20, textAlign:"center", cursor:"pointer",
        background: drag ? "var(--acc-bg)" : "var(--bg2)",
        transition:"all .15s", overflow:"hidden",
      }}>
      {preview ? (
        <img src={preview} alt="preview" style={{ maxHeight:120, objectFit:"contain", borderRadius:8, width:"100%" }}/>
      ) : (
        <>
          <p style={{ fontSize:22, marginBottom:6 }}>🛸</p>
          <p style={{ fontSize:13, color:"var(--txt)", fontWeight:500, marginBottom:4 }}>{label}</p>
          <p style={{ fontSize:10, color:"var(--txt3)" }}>{sub}</p>
        </>
      )}
      {fileName && <p style={{ fontSize:10, color:"var(--acc2)", marginTop:6 }}>📎 {fileName}</p>}
      <input id="dz-input" type="file" accept="image/*" style={{ display:"none" }}
        onChange={e => { const f=e.target.files?.[0]; if(f) onFile(f); }}/>
    </div>
  );
}
