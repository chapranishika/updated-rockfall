"use client";
import React, { useState, useRef } from "react";
import { LivePill, RiskBar, rc, rb, rd, Card, CardSm, CardLabel } from "@/components/ui/index";
import { useTheme } from "@/lib/ThemeContext";
import { 
  UploadCloud, 
  Search, 
  MapPin, 
  CloudRain, 
  Thermometer, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  Navigation, 
  Wind, 
  Droplets, 
  Compass, 
  Activity,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Sun,
  Moon
} from "lucide-react";

export default function TouristPage() {
  const { theme, toggleTheme } = useTheme();
  const [locationName, setLocationName] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [weatherTab, setWeatherTab] = useState<"current" | "forecast">("current");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hover states for premium feedback
  const [hoverLocate, setHoverLocate] = useState(false);
  const [hoverSubmit, setHoverSubmit] = useState(false);
  const [hoverUploadZone, setHoverUploadZone] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);
  const [hoverThemeToggle, setHoverThemeToggle] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setCoords({ latitude: lat, longitude: lon });
        setLocationName(`GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        setGpsLoading(false);
      },
      (err) => {
        setError(`Failed to retrieve live location: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim()) {
      setError("Please enter your current location.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("location_name", locationName);

    if (coords && locationName.startsWith("GPS:")) {
      formData.append("latitude", coords.latitude.toString());
      formData.append("longitude", coords.longitude.toString());
    }

    if (file) {
      formData.append("file", file);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/predict/tourist`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to analyze safety risk.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setLocationName("");
    setFile(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    setCoords(null);
  };

  const level = (result?.risk_level ?? "LOW").toUpperCase();
  const pct = Math.round((result?.final_risk_score ?? 0) * 100);
  const color = rc(level);

  // Styled glassmorphism panel styles
  const glassStyle: React.CSSProperties = {
    background: theme === "dark" ? "rgba(18, 22, 37, 0.45)" : "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.06)",
    borderRadius: 16,
    padding: 24,
    boxShadow: theme === "dark" ? "0 8px 32px 0 rgba(0, 0, 0, 0.3)" : "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 12
  };

  return (
    <div className="p-6" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 840, margin: "0 auto", paddingBottom: 40 }}>
      
      {/* Premium Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", color: "var(--txt)", display: "flex", alignItems: "center", gap: 10 }}>
            <Compass size={28} style={{ color: "var(--acc)", filter: "drop-shadow(0 0 8px rgba(79, 142, 247, 0.3))" }} />
            <span style={{ background: "linear-gradient(135deg, #e8ecf6 40%, #7ab3ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Slope Safety Assessment
            </span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--txt3)", marginTop: 4 }}>
            Real-time multi-modal slope stability diagnosis for local tourist regions.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LivePill connected={!error} />
          <button
            type="button"
            onClick={toggleTheme}
            onMouseEnter={() => setHoverThemeToggle(true)}
            onMouseLeave={() => setHoverThemeToggle(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid var(--bdr2)",
              background: hoverThemeToggle ? "var(--bg2)" : "rgba(0,0,0,0.03)",
              color: "var(--txt)",
              cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
            }}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? <Sun size={16} style={{ color: "#eab308" }} /> : <Moon size={16} style={{ color: "#7c3aed" }} />}
          </button>
        </div>
      </div>

      {!result && (
        <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Location input panel */}
          <div style={glassStyle}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: "var(--acc2)" }}>
              Current Location Reference
            </label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--txt3)" }} />
                <input
                  type="text"
                  placeholder="Type city, national park, or coords (e.g. Yosemite Valley)..."
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    if (coords) setCoords(null);
                  }}
                  style={{
                    width: "100%", padding: "14px 14px 14px 42px", borderRadius: 10,
                    background: "var(--bg2)", border: "1px solid var(--bdr)",
                    color: "var(--txt)", fontSize: 13, outline: "none",
                    transition: "all .2s ease",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--acc)"; e.currentTarget.style.boxShadow = "0 0 10px rgba(6, 182, 212, 0.15)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={gpsLoading}
                onMouseEnter={() => setHoverLocate(true)}
                onMouseLeave={() => setHoverLocate(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "14px 18px", borderRadius: 10, 
                  border: "1px solid var(--bdr2)",
                  background: hoverLocate ? "var(--bg3)" : "var(--bg2)",
                  color: coords ? "var(--acc)" : "var(--txt2)", 
                  fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all .2s ease"
                }}
              >
                <Navigation size={14} className={gpsLoading ? "animate-spin" : ""} style={{ color: coords ? "var(--acc)" : "inherit" }} />
                <span>{gpsLoading ? "Acquiring GPS..." : "Use My GPS"}</span>
              </button>
            </div>
          </div>

          {/* Photo upload panel */}
          <div style={glassStyle}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color: "var(--acc2)" }}>
              Slope Observation Photo
            </label>
            
            <div
              onClick={triggerFileInput}
              onMouseEnter={() => setHoverUploadZone(true)}
              onMouseLeave={() => setHoverUploadZone(false)}
              style={{
                border: hoverUploadZone ? "1px dashed var(--acc)" : "1px dashed var(--bdr2)", 
                borderRadius: 12, padding: "32px 20px",
                textAlign: "center", cursor: "pointer", 
                background: hoverUploadZone ? "var(--acc-bg)" : "var(--bg2)",
                transition: "all .2s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              {imagePreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8, objectFit: "contain", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
                  />
                  <p style={{ fontSize: 12, color: "var(--acc2)", fontWeight: 600 }}>
                    {file?.name} (Click to swap image)
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 99, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <UploadCloud size={28} style={{ color: hoverUploadZone ? "var(--acc)" : "var(--txt3)", transition: "all 0.2s" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "var(--txt)", fontWeight: 600 }}>
                      Drop slope photo here, or browse files
                    </p>
                    <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 4 }}>
                      Supports JPEG, PNG, TIFF files up to 10MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 12, padding: "12px 16px", color: "#ef4444", fontSize: 13, display: "flex", gap: 8, alignItems: "center"
            }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            onMouseEnter={() => setHoverSubmit(true)}
            onMouseLeave={() => setHoverSubmit(false)}
            style={{
              padding: "16px 24px", borderRadius: 12, border: "none",
              background: loading 
                ? "var(--bg3)" 
                : hoverSubmit 
                  ? "linear-gradient(135deg, var(--acc), var(--acc2))" 
                  : "linear-gradient(135deg, var(--acc2), var(--acc))",
              boxShadow: hoverSubmit && !loading ? "0 4px 20px rgba(124, 58, 237, 0.35)" : "none",
              color: loading ? "var(--txt3)" : "white", 
              fontWeight: 700, fontSize: 14, 
              cursor: loading ? "not-allowed" : "pointer",
              transform: hoverSubmit && !loading ? "translateY(-1px)" : "none",
              transition: "all .2s cubic-bezier(.4,0,.2,1)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>Geocoding & Running Stability Multi-Modal AI...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Execute Safety Diagnostics</span>
              </>
            )}
          </button>
        </form>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Safety Summary Hero Dashboard Card */}
          <div style={{
            background: theme === "dark" 
              ? "linear-gradient(135deg, rgba(18, 22, 37, 0.85), rgba(12, 15, 26, 0.95))" 
              : "linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(241, 245, 249, 0.95))",
            border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.06)", 
            borderRadius: 20, padding: 32,
            position: "relative", overflow: "hidden",
            boxShadow: theme === "dark" ? "0 10px 40px rgba(0,0,0,0.5)" : "0 10px 40px rgba(31, 38, 135, 0.05)"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: color, borderRadius: "20px 20px 0 0" }} />
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--txt2)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              <MapPin size={14} style={{ color }} />
              <span>{result.tourist_meta?.resolved_location}</span>
            </div>

            {/* Parsed Location details */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {result.tourist_meta?.city && result.tourist_meta.city !== "Unknown City" && (
                <span style={{ background: "rgba(255,255,255,0.03)", color: "var(--txt2)", fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ opacity: 0.6, fontSize: 8, fontWeight: 800 }}>CITY</span>
                  <strong>{result.tourist_meta.city}</strong>
                </span>
              )}
              {result.tourist_meta?.state && result.tourist_meta.state !== "Unknown State" && (
                <span style={{ background: "rgba(255,255,255,0.03)", color: "var(--txt2)", fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ opacity: 0.6, fontSize: 8, fontWeight: 800 }}>STATE</span>
                  <strong>{result.tourist_meta.state}</strong>
                </span>
              )}
              {result.tourist_meta?.country && result.tourist_meta.country !== "Unknown Country" && (
                <span style={{ background: "rgba(255,255,255,0.03)", color: "var(--txt2)", fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ opacity: 0.6, fontSize: 8, fontWeight: 800 }}>COUNTRY</span>
                  <strong>{result.tourist_meta.country}</strong>
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-4px", lineHeight: 1, color, filter: `drop-shadow(0 0 15px ${color}33)` }}>
                {pct}%
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", color, marginTop: 8 }}>
                {level} RISK PROFILE
              </p>
              <p style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6, maxWidth: 520, margin: "12px auto 20px", textAlign: "center" }}>
                {result.recommendation}
              </p>
            </div>

            <RiskBar score={result.final_risk_score} level={level} />

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
              <span style={{
                padding: "8px 22px", borderRadius: 99,
                background: rb(level), color, border: `1px solid ${rd(level)}`,
                fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em"
              }}>
                {level === "LOW" && "Safe to Proceed"}
                {level === "MEDIUM" && "Exercise High Caution"}
                {level === "HIGH" && "Restricted Access Zone"}
                {level === "CRITICAL" && "Immediate Evacuation"}
              </span>
              <button
                onClick={resetSearch}
                onMouseEnter={() => setHoverReset(true)}
                onMouseLeave={() => setHoverReset(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 20px", borderRadius: 99, 
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: hoverReset ? "rgba(255,255,255,0.05)" : "transparent",
                  color: "var(--txt2)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                <span>Evaluate New Location</span>
              </button>
            </div>
          </div>

          {/* Grid section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            
            {/* Weather tabbed dashboard panel */}
            <div style={glassStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <CardLabel text="Climatological Parameters" />
              </div>
              
              <div style={{ display: "flex", background: "rgba(5, 7, 13, 0.4)", borderRadius: 8, padding: 2, border: "1px solid rgba(255,255,255,0.03)", marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setWeatherTab("current")}
                  style={{
                    flex: 1, padding: "8px 0", background: weatherTab === "current" ? "rgba(255,255,255,0.05)" : "none", 
                    border: "none", borderRadius: 6,
                    color: weatherTab === "current" ? "var(--txt)" : "var(--txt3)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s ease"
                  }}
                >
                  Live Report
                </button>
                <button
                  type="button"
                  onClick={() => setWeatherTab("forecast")}
                  style={{
                    flex: 1, padding: "8px 0", background: weatherTab === "forecast" ? "rgba(255,255,255,0.05)" : "none", 
                    border: "none", borderRadius: 6,
                    color: weatherTab === "forecast" ? "var(--txt)" : "var(--txt3)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s ease"
                  }}
                >
                  7-Day Outlook
                </button>
              </div>

              {weatherTab === "current" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ background: "rgba(79, 142, 247, 0.08)", padding: 8, borderRadius: 8, color: "var(--acc)" }}>
                      <CloudRain size={20} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>
                        {result.tourist_meta?.weather?.description}
                      </p>
                      <p style={{ fontSize: 10, color: "var(--txt3)", marginTop: 2 }}>
                        Current regional climate state
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase" }}>TEMPERATURE</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Thermometer size={14} style={{ color: "var(--txt3)" }} />
                        <span>{result.tourist_meta?.weather?.temperature_c}°C</span>
                      </p>
                    </div>
                    <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase" }}>PRECIPITATION</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <CloudRain size={14} style={{ color: "var(--txt3)" }} />
                        <span>{result.tourist_meta?.weather?.rainfall_mm} mm</span>
                      </p>
                    </div>
                    <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase" }}>HUMIDITY</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Droplets size={14} style={{ color: "var(--txt3)" }} />
                        <span>{result.tourist_meta?.weather?.humidity_pct}%</span>
                      </p>
                    </div>
                    <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--txt3)", textTransform: "uppercase" }}>WIND VELOCITY</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--txt)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Wind size={14} style={{ color: "var(--txt3)" }} />
                        <span>{result.tourist_meta?.weather?.wind_speed_kmh} km/h</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 156, overflowY: "auto", paddingRight: 4 }}>
                  {result.tourist_meta?.forecast?.map((day: any, idx: number) => {
                    const dateObj = new Date(day.date);
                    const dayName = idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "8px 12px", background: "rgba(5, 7, 13, 0.25)", border: "1px solid rgba(255,255,255,0.02)", borderRadius: 8 }}>
                        <span style={{ color: "var(--txt)", fontWeight: 700, width: "95px" }}>{dayName}</span>
                        <span style={{ color: "var(--txt3)", flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginRight: 8 }}>{day.description}</span>
                        <span style={{ color: "var(--txt2)", width: "65px", textAlign: "right" }}>
                          <strong>{Math.round(day.temp_max)}°</strong> / {Math.round(day.temp_min)}°
                        </span>
                        {day.precipitation_mm > 0 ? (
                          <span style={{ color: "#3b82f6", fontSize: 10, width: "55px", textAlign: "right", display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            <CloudRain size={10} />
                            <span>{day.precipitation_mm}mm</span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--txt3)", fontSize: 10, width: "55px", textAlign: "right", display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            <Thermometer size={10} />
                            <span>0mm</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active geotechnical telemetry */}
            <div style={glassStyle}>
              <CardLabel text="Geotechnical Telemetry" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, justifyContent: "center" }}>
                
                <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--txt2)" }}>Vibration Threshold</span>
                    <strong style={{ color: "var(--acc2)" }}>{result.sensor_result?.sensor_values?.vibration?.toFixed(3) ?? "0.020"} g</strong>
                  </div>
                  <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 9 }}>
                    <div style={{ width: `${Math.min(100, (result.sensor_result?.sensor_values?.vibration ?? 0.02) * 200)}%`, height: "100%", background: "var(--acc)", borderRadius: 9 }} />
                  </div>
                </div>

                <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--txt2)" }}>Displacement Rate</span>
                    <strong style={{ color: "#ef4444" }}>{result.sensor_result?.sensor_values?.displacement?.toFixed(2) ?? "0.10"} mm</strong>
                  </div>
                  <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 9 }}>
                    <div style={{ width: `${Math.min(100, (result.sensor_result?.sensor_values?.displacement ?? 0.1) * 15)}%`, height: "100%", background: "#ef4444", borderRadius: 9 }} />
                  </div>
                </div>

                <div style={{ background: "rgba(5, 7, 13, 0.2)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--txt2)" }}>Pore Water Pressure</span>
                    <strong style={{ color: "#a855f7" }}>{result.sensor_result?.sensor_values?.pore_pressure?.toFixed(2) ?? "0.05"} kPa</strong>
                  </div>
                  <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 9 }}>
                    <div style={{ width: `${Math.min(100, (result.sensor_result?.sensor_values?.pore_pressure ?? 0.05) * 40)}%`, height: "100%", background: "#a855f7", borderRadius: 9 }} />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Nearby Terrains Danger list */}
          {result.tourist_meta?.terrains && (
            <div style={glassStyle}>
              <CardLabel text={`Adjacent Micro-Terrain Hazard Breakdown (${result.tourist_meta.terrain_category})`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
                {result.tourist_meta.terrains.map((t: any, idx: number) => {
                  let barColor = "#22c55e"; // green
                  if (t.danger_score >= 75) barColor = "#ef4444"; // red
                  else if (t.danger_score >= 55) barColor = "#f97316"; // orange
                  else if (t.danger_score >= 30) barColor = "#eab308"; // yellow
                  
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: idx < result.tourist_meta.terrains.length - 1 ? 12 : 0, borderBottom: idx < result.tourist_meta.terrains.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: "var(--txt)", display: "flex", alignItems: "center", gap: 6 }}>
                          <MapPin size={13} style={{ color: barColor, opacity: 0.8 }} />
                          <span>{t.name}</span>
                        </span>
                        <span style={{ color: barColor, background: `${barColor}10`, border: `1px solid ${barColor}25`, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                          {t.danger_score}% DANGER
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.03)", borderRadius: 9, overflow: "hidden" }}>
                        <div style={{ width: `${t.danger_score}%`, height: "100%", background: barColor, borderRadius: 9 }} />
                      </div>
                      <p style={{ fontSize: 11, color: "var(--txt2)", lineHeight: 1.4 }}>
                        {t.condition}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Image segmentation result block */}
          {result.image_overlay_b64 && (
            <div style={glassStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <CardLabel text="U-Net Neural Image Segmentation Analysis" />
                <button
                  type="button"
                  onClick={() => setShowOverlay(!showOverlay)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(18, 22, 37, 0.6)", color: "var(--txt2)", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--acc)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                >
                  <Eye size={12} />
                  <span>{showOverlay ? "View Original Photo" : "View Neural Segmentation"}</span>
                </button>
              </div>

              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "black" }}>
                <img
                  src={showOverlay ? `data:image/png;base64,${result.image_overlay_b64}` : imagePreview || ""}
                  alt="Segmentation result"
                  style={{ width: "100%", height: "auto", display: "block", maxHeight: 420, objectFit: "contain" }}
                />
                <div style={{
                  position: "absolute", bottom: 14, left: 14, background: "rgba(5, 7, 13, 0.85)",
                  backdropFilter: "blur(8px)", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)"
                }}>
                  <p style={{ fontSize: 12, color: "white", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldAlert size={14} style={{ color: "var(--hi)" }} />
                    <span>Debris Coverage Profile: <span style={{ color: "var(--acc2)" }}>{result.image_result?.coverage_pct}%</span></span>
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                <CardSm>
                  <p style={{ fontSize: 9, color: "var(--txt3)", textTransform: "uppercase", fontWeight: 700 }}>AI Segmentation Score</p>
                  <p style={{ fontSize: 18, color: "var(--txt)", fontWeight: 700, marginTop: 4 }}>{result.explainability?.image_score?.toFixed(4)}</p>
                  <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>Determined by the U-Net convolutional layer</p>
                </CardSm>
                <CardSm>
                  <p style={{ fontSize: 9, color: "var(--txt3)", textTransform: "uppercase", fontWeight: 700 }}>Risk Divergence Safe Bias</p>
                  <p style={{ fontSize: 18, color: result.explainability?.divergence > 0.30 ? "var(--hi)" : "var(--lo)", fontWeight: 700, marginTop: 4 }}>
                    {result.explainability?.divergence > 0.30 ? "ACTIVE FUSION" : "INACTIVE"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>
                    Divergence score: {result.explainability?.divergence?.toFixed(4)}
                  </p>
                </CardSm>
              </div>
            </div>
          )}

          {/* Explainability factors breakdown */}
          <div style={glassStyle}>
            <CardLabel text="Telemetry and Vision Weight Distribution" />
            <p style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.6 }}>
              The multi-modal model calculates the risk profile by fusing geotechnical sensors (weighted <strong>55%</strong>) with real-time computer vision analysis (weighted <strong>45%</strong>).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <div style={{ background: "rgba(5, 7, 13, 0.25)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--txt2)", fontWeight: 600 }}>Geophysical Sensor Score Contribution:</span>
                <span style={{ fontSize: 12, color: "var(--txt)", fontWeight: 700 }}>{result.explainability?.sensor_score?.toFixed(4)}</span>
              </div>
              {result.explainability?.image_score > 0 && (
                <div style={{ background: "rgba(5, 7, 13, 0.25)", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--txt2)", fontWeight: 600 }}>Slope Vision Score Contribution:</span>
                  <span style={{ fontSize: 12, color: "var(--txt)", fontWeight: 700 }}>{result.explainability?.image_score?.toFixed(4)}</span>
                </div>
              )}
              <div style={{ background: "rgba(18, 22, 37, 0.6)", padding: 12, borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--txt)", fontWeight: 700 }}>AI Model Confidence Factor:</span>
                <span style={{ fontSize: 12, color: "var(--acc)", fontWeight: 800 }}>{(result.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
