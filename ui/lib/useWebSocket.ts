"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SimReading {
  timestamp:    string;
  vibration:    number;
  displacement: number;
  pore_pressure:number;
  strain:       number;
  temperature:  number;
  rainfall:     number;
  risk_score:   number;
  risk_level:   string;
  alert:        boolean;
  event_active: boolean;
  [key: string]: unknown;
}

const WS_URL = () => {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    .replace(/^http/, "ws");
  return `${base}/ws/sensor-stream`;
};

export function useWebSocket(maxHistory = 120) {
  const [connected, setConnected] = useState(false);
  const [latest,    setLatest]    = useState<SimReading | null>(null);
  const [history,   setHistory]   = useState<SimReading[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const wsRef   = useRef<WebSocket | null>(null);
  const retryRef= useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(WS_URL());
      wsRef.current = ws;
      ws.onopen  = () => { setConnected(true); setError(null); };
      ws.onclose = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => setError("WebSocket unavailable — backend may be offline");
      ws.onmessage = (e) => {
        try {
          const d: SimReading = JSON.parse(e.data);
          setLatest(d);
          setHistory(h => [...h.slice(-(maxHistory - 1)), d]);
        } catch {}
      };
    } catch {
      setError("Cannot connect");
      retryRef.current = setTimeout(connect, 5000);
    }
  }, [maxHistory]);

  useEffect(() => {
    connect();
    return () => {
      retryRef.current && clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, latest, history, error };
}
