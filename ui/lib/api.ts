const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ImageResult {
  risk_score: number; risk_level: string; alert: boolean;
  coverage_pct: number; mean_prob: number;
  overlay_b64?: string; mask_b64?: string; model?: string; error?: string;
}

export interface FusionResult {
  final_risk_score: number; risk_level: RiskLevel; risk_color: string;
  alert: boolean; confidence: number; recommendation: string; mode: string;
  image_result?: { coverage_pct: number; risk_score: number; risk_level: string };
  image_overlay_b64?: string;
  explainability?: {
    sensor_score: number; image_score: number;
    sensor_weight: number; image_weight: number; divergence: number;
    factors: Record<string, string>;
  };
}

// ── Design helpers (also exported from components/ui/index.tsx for page use) ──
export const RISK_COLORS: Record<string, string> = {
  LOW:"#22c55e", MEDIUM:"#f59e0b", HIGH:"#ef4444", CRITICAL:"#ff1744",
};
export const RISK_BGS: Record<string, string> = {
  LOW:"#22c55e14", MEDIUM:"#f59e0b14", HIGH:"#ef444414", CRITICAL:"#ff174414",
};
export const RISK_BDRS: Record<string, string> = {
  LOW:"#22c55e30", MEDIUM:"#f59e0b30", HIGH:"#ef444430", CRITICAL:"#ff174430",
};
export const RECS: Record<string, string> = {
  LOW:      "Continue routine monitoring. Conditions stable.",
  MEDIUM:   "Heightened monitoring. Notify local authorities.",
  HIGH:     "Issue public alert. Increase monitoring. Prepare evacuation.",
  CRITICAL: "Evacuate immediately. Alert NDRF. Close all access roads.",
};
export const TOURIST_RECS: Record<string, string> = {
  LOW:      "Conditions are stable. Normal hiking and tourism activities may proceed.",
  MEDIUM:   "Elevated risk detected. Proceed with extra caution. Avoid cliff edges.",
  HIGH:     "High rockfall risk. Non-essential activities discouraged.",
  CRITICAL: "CRITICAL RISK. All tourism activities suspended. Evacuate immediately.",
};

export function rc(l: string): string {
  return RISK_COLORS[l?.toUpperCase()] ?? "#5a6480";
}
export function rb(l: string): string {
  return RISK_BGS[l?.toUpperCase()] ?? "var(--bg2)";
}
export function rd(l: string): string {
  return RISK_BDRS[l?.toUpperCase()] ?? "var(--bdr)";
}

// ── API calls ──────────────────────────────────────────────────────────────────
export const api = {
  health: (): Promise<{ status: string; models: Record<string, boolean> }> =>
    fetch(`${BASE}/health`).then(r => r.json()),

  demo: (): Promise<FusionResult> =>
    fetch(`${BASE}/predict/demo`).then(r => r.json()),

  predictImage: async (file: File): Promise<ImageResult> => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`${BASE}/predict/image`, { method:"POST", body:fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((e as Record<string,string>).detail ?? (e as Record<string,string>).error ?? res.statusText);
    }
    return res.json();
  },

  predictFinal: async (
    sensors: Record<string, number>,
    file?: File,
  ): Promise<FusionResult> => {
    const fd = new FormData();
    Object.entries(sensors).forEach(([k, v]) => fd.append(k, String(v)));
    if (file) fd.append("file", file);
    const res = await fetch(`${BASE}/predict/final`, { method:"POST", body:fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((e as Record<string,string>).detail ?? (e as Record<string,string>).error ?? res.statusText);
    }
    return res.json();
  },
};
