"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMode } from "@/lib/ModeContext";

const NAV_WORKER = [
  { href: "/",         icon: "⬡",  label: "Dashboard",     group: "overview"   },
  { href: "/tourist",  icon: "🛡️", label: "Safety Status", group: "overview"   },
  { href: "/sensors",  icon: "📡", label: "Sensors",       group: "monitoring" },
  { href: "/heatmap",  icon: "🗺️", label: "Heatmap",       group: "monitoring" },
  { href: "/analysis", icon: "🔬", label: "Image Analysis", group: "monitoring" },
  { href: "/alerts",   icon: "🔔", label: "Alerts",        group: "monitoring" },
  { href: "/reports",  icon: "📊", label: "Reports",       group: "monitoring" },
];

const NAV_TOURIST = [
  { href: "/tourist",  icon: "🛡️", label: "Safety Status", group: "overview" },
];

export default function Sidebar() {
  const path = usePathname();
  const { mode, setMode } = useMode();

  const NAV    = mode === "tourist" ? NAV_TOURIST : NAV_WORKER;
  const groups = mode === "tourist" ? ["overview"] : ["overview", "monitoring"];

  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);

  return (
    <aside className="flex flex-col h-full flex-shrink-0"
      style={{ width: 220, background: "var(--bg1)", borderRight: "1px solid var(--bdr)" }}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: "var(--bdr)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#4f8ef7,#7c3aed)" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 19h20L12 2z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".5"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ letterSpacing: "-.3px", color: "var(--txt)" }}>Rockfall AI</p>
          <p className="text-xs" style={{ color: "var(--txt3)" }}>Risk Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map(group => (
          <div key={group}>
            <p className="px-4 py-2 mt-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--txt3)", letterSpacing: ".1em" }}>
              {group}
            </p>
            {NAV.filter(n => n.group === group).map(({ href, icon, label }) => {
              const on = active(href);
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5"
                  style={{
                    background: on ? "var(--acc-bg)" : "transparent",
                    color:      on ? "var(--acc2)"   : "var(--txt2)",
                    border:     on ? "1px solid #4f8ef725" : "1px solid transparent",
                  }}>
                  <span style={{ fontSize: 14, width: 16, textAlign: "center" }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mode toggle */}
      <div className="mx-2 mb-3 rounded-xl p-3" style={{ background: "var(--bg2)", border: "1px solid var(--bdr)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: "var(--txt3)", letterSpacing: ".1em" }}>View mode</p>
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "var(--bg0)" }}>
          {(["worker", "tourist"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
              style={{
                background: mode === m ? "var(--acc)" : "transparent",
                color:      mode === m ? "#fff"       : "var(--txt3)",
              }}>
              {m}
            </button>
          ))}
        </div>
        {mode === "tourist" && (
          <p className="text-xs mt-2" style={{ color: "var(--txt3)" }}>
            Simplified view — sensor telemetry hidden
          </p>
        )}
      </div>
    </aside>
  );
}
