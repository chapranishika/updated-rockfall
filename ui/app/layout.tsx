import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { ModeProvider } from "@/lib/ModeContext";

export const metadata: Metadata = {
  title: "Rockfall AI | Geophysical Risk Platform",
  description: "Real-time multi-modal rockfall risk monitoring for workers and tourists",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="flex h-screen overflow-hidden" style={{ background: "var(--bg0)", color: "var(--txt)" }}>
        <ModeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </ModeProvider>
      </body>
    </html>
  );
}
