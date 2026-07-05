"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Mode = "worker" | "tourist";

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
}

const ModeContext = createContext<ModeContextValue>({ mode: "worker", setMode: () => {} });

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("worker");

  useEffect(() => {
    const saved = localStorage.getItem("rockfall-mode") as Mode | null;
    if (saved === "worker" || saved === "tourist") setModeState(saved);
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem("rockfall-mode", m);
  };

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}
