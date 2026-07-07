"use client";
import React, { useState, useRef } from "react";
import { LivePill, RiskBar, rc, rb, rd, Card, CardSm, CardLabel } from "@/components/ui/index";
import { Upload, Search, MapPin, CloudRain, Thermometer, AlertTriangle, ShieldCheck, RefreshCw, Eye } from "lucide-react";

export default function TouristPage() {
  const [locationName, setLocationName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const level = (result?.risk_level ?? "LOW").toUpperCase();
  const pct = Math.round((result?.final_risk_score ?? 0) * 100);
  const color = rc(level);

  return (
    <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.5px", color: "var(--txt)" }}>
            🌄 Tourist Slope Safety Check
          </h1>
          <p style={{ fontSize: 13, color: "var(--txt3)", marginTop: 4 }}>
            Enter your location and upload a live photo of nearby slopes to get a real-time hazard evaluation.
          </p>
        </div>
        <LivePill connected={!error} />
      </div>

      {!result && (
        <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Location input */}
          <div style={{
            background: "var(--bg1)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18,
            display: "flex", flexDirection: "column", gap: 10
          }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)" }}>
              1. Where are you currently?
            </label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--txt3)" }} />
              <input
                type="text"
                placeholder="e.g. Yosemite Valley, Shimla, Mount Rainier..."
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                style={{
                  width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10,
                  background: "var(--bg2)", border: "1px solid var(--bdr)",
                  color: "var(--txt)", fontSize: 13, outline: "none",
                  transition: "border-color .2s"
                }}
              />
            </div>
          </div>

          {/* Photo upload */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              background: "var(--bg1)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18,
              display: "flex", flexDirection: "column", gap: 10
            }}
          >
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)" }}>
              2. Upload a live photo of the slope (Optional but recommended)
            </label>
            
            <div
              onClick={triggerFileInput}
              style={{
                border: "2px dashed var(--bdr)", borderRadius: 10, padding: "28px 16px",
                textAlign: "center", cursor: "pointer", background: "var(--bg2)",
                transition: "border-color .2s, background-color .2s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--acc)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--bdr)"; }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              {imagePreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 6, objectFit: "contain", border: "1px solid var(--bdr)" }}
                  />
                  <p style={{ fontSize: 12, color: "var(--txt2)", fontWeight: 500 }}>
                    {file?.name} (Click or drag to replace)
                  </p>
                </div>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--txt3)" }} />
                  <p style={{ fontSize: 13, color: "var(--txt2)", fontWeight: 500 }}>
                    Click to upload or drag & drop a slope photo
                  </p>
                  <p style={{ fontSize: 11, color: "var(--txt3)" }}>
                    PNG, JPEG, or TIFF up to 10MB
                  </p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 12, display: "flex", gap: 8, alignItems: "center"
            }}>
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 20px", borderRadius: 10, border: "none",
              background: loading ? "var(--bdr)" : "linear-gradient(135deg, #4f8ef7, #2f69c7)",
              color: "white", fontWeight: 600, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
              transition: "transform .1s, opacity .2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>Geocoding & Analyzing slope...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Verify Real-Time Safety</span>
              </>
            )}
          </button>
        </form>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Safety Summary Hero */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg2), var(--bg3))",
            border: `1px solid var(--bdr2)`, borderRadius: 20, padding: 28,
            textAlign: "center", position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "20px 20px 0 0" }} />
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--txt3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
              <MapPin size={12} style={{ color }} />
              <span>{result.tourist_meta?.resolved_location}</span>
            </div>

            <p style={{ fontSize: 64, fontWeight: 700, letterSpacing: "-3px", lineHeight: 1, color }}>{pct}%</p>
            <p style={{ fontSize: 15, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color, margin: "10px 0 6px" }}>
              {level} HAZARD LEVEL
            </p>
            <p style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6, maxWidth: 450, margin: "0 auto 16px" }}>
              {result.recommendation}
            </p>

            <RiskBar score={result.final_risk_score} level={level} />

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <span style={{
                padding: "6px 18px", borderRadius: 99,
                background: rb(level), color, border: `1px solid ${rd(level)}`,
                fontSize: 12, fontWeight: 600
              }}>
                {level === "LOW" && "Safe to Hike"}
                {level === "MEDIUM" && "Proceed with Caution"}
                {level === "HIGH" && "Avoid Cliff Slopes"}
                {level === "CRITICAL" && "Evacuate Zone Immediately"}
              </span>
              <button
                onClick={resetSearch}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 16px", borderRadius: 99, border: "1px solid var(--bdr)",
                  background: "var(--bg1)", color: "var(--txt2)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                <RefreshCw size={12} />
                <span>Check Another Location</span>
              </button>
            </div>
          </div>

          {/* Real-time Online Weather integration */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CardLabel text="Online Weather Info" />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ background: "var(--bg3)", padding: 10, borderRadius: 10, color: "var(--acc)" }}>
                  <CloudRain size={22} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>
                    {result.tourist_meta?.weather?.description}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>
                    Real-time online data from Open-Meteo
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Thermometer size={14} style={{ color: "var(--txt3)" }} />
                  <span style={{ fontSize: 12, color: "var(--txt2)" }}>
                    Temp: <strong>{result.tourist_meta?.weather?.temperature_c}°C</strong>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <CloudRain size={14} style={{ color: "var(--txt3)" }} />
                  <span style={{ fontSize: 12, color: "var(--txt2)" }}>
                    Rain: <strong>{result.tourist_meta?.weather?.rainfall_mm} mm</strong>
                  </span>
                </div>
              </div>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CardLabel text="Active Area Sensors" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, justifyContent: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--txt2)" }}>
                  <span>Vibration:</span>
                  <strong>{result.sensor_result?.sensor_values?.vibration?.toFixed(3) ?? "0.02"}g</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--txt2)" }}>
                  <span>Displacement:</span>
                  <strong>{result.sensor_result?.sensor_values?.displacement?.toFixed(2) ?? "0.10"}mm</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--txt2)" }}>
                  <span>Pore Pressure:</span>
                  <strong>{result.sensor_result?.sensor_values?.pore_pressure?.toFixed(2) ?? "0.05"}kPa</strong>
                </div>
              </div>
            </Card>
          </div>

          {/* Image segmentation result */}
          {result.image_overlay_b64 && (
            <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <CardLabel text="U-Net Image Segmentation analysis" />
                <button
                  onClick={() => setShowOverlay(!showOverlay)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--bdr)",
                    background: "var(--bg3)", color: "var(--txt2)", fontSize: 10, fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <Eye size={12} />
                  <span>{showOverlay ? "Show Original" : "Show U-Net Overlay"}</span>
                </button>
              </div>

              <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--bdr)", background: "black" }}>
                <img
                  src={showOverlay ? `data:image/png;base64,${result.image_overlay_b64}` : imagePreview || ""}
                  alt="Segmentation result"
                  style={{ width: "100%", height: "auto", display: "block", maxHeight: 400, objectFit: "contain" }}
                />
                <div style={{
                  position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(4px)", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)"
                }}>
                  <p style={{ fontSize: 11, color: "white", fontWeight: 600 }}>
                    Detected Rockfall Debris: <span style={{ color: "var(--acc)" }}>{result.image_result?.coverage_pct}%</span>
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                <CardSm>
                  <p style={{ fontSize: 10, color: "var(--txt3)", textTransform: "uppercase", fontWeight: 600 }}>U-Net Model Score</p>
                  <p style={{ fontSize: 18, color: "var(--txt)", fontWeight: 700, marginTop: 4 }}>{result.explainability?.image_score?.toFixed(4)}</p>
                  <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>Derived from {result.image_result?.coverage_pct}% coverage area</p>
                </CardSm>
                <CardSm>
                  <p style={{ fontSize: 10, color: "var(--txt3)", textTransform: "uppercase", fontWeight: 600 }}>Safety Bias Trigger</p>
                  <p style={{ fontSize: 18, color: "var(--txt)", fontWeight: 700, marginTop: 4 }}>
                    {result.explainability?.divergence > 0.30 ? "🔴 Triggered" : "🟢 Inactive"}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--txt3)", marginTop: 2 }}>
                    Divergence score: {result.explainability?.divergence?.toFixed(4)}
                  </p>
                </CardSm>
              </div>
            </Card>
          )}

          {/* Explainability factors */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CardLabel text="Safety Fusion Breakdown" />
            <p style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.6 }}>
              The safety rating fuses two factors: the local geophysical state (weather + baseline sensors) weighting <strong>55%</strong>, and visual image segmentation weighting <strong>45%</strong>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={{ background: "var(--bg3)", padding: 10, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--txt2)", fontWeight: 500 }}>Geophysical Sensor/Weather Score:</span>
                <span style={{ fontSize: 12, color: "var(--txt)", fontWeight: 700 }}>{result.explainability?.sensor_score?.toFixed(4)}</span>
              </div>
              {result.explainability?.image_score > 0 && (
                <div style={{ background: "var(--bg3)", padding: 10, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--txt2)", fontWeight: 500 }}>Slope U-Net Photo Score:</span>
                  <span style={{ fontSize: 12, color: "var(--txt)", fontWeight: 700 }}>{result.explainability?.image_score?.toFixed(4)}</span>
                </div>
              )}
              <div style={{ background: "var(--bg2)", padding: 10, borderRadius: 8, border: "1px solid var(--bdr)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--txt2)", fontWeight: 600 }}>Confidence Factor:</span>
                <span style={{ fontSize: 12, color: "var(--acc)", fontWeight: 700 }}>{result.confidence * 100}%</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
