import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const TCCScanline: React.FC = () => {
  const frame = useCurrentFrame();

  // Scanline sweeps across the curve area (X from ~900px to ~1350px)
  const laserX = interpolate(frame, [15, 85], [880, 1340], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.4, 1),
  });

  // Dynamic trip margin calculated readout
  const marginMs = Math.round(
    interpolate(frame, [20, 80], [180, 240], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  // Badge entrance animation
  const badgeScale = interpolate(frame, [30, 50], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 12 }),
  });

  const badgeOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 45,
      }}
    >
      {/* Scanning laser line */}
      <div
        style={{
          position: "absolute",
          left: `${laserX}px`,
          top: "400px",
          height: "380px",
          width: "2px",
          background:
            "linear-gradient(180deg, rgba(56, 189, 248, 0) 0%, rgba(56, 189, 248, 0.9) 50%, rgba(56, 189, 248, 0) 100%)",
          boxShadow: "0 0 12px #38bdf8, 0 0 24px #0284c7",
        }}
      >
        {/* Reticle / Crosshair */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "1.5px solid #38bdf8",
            boxShadow: "0 0 8px #38bdf8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        {/* Live Coordinate Callout */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "14px",
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "6px",
            padding: "5px 10px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            DISCRIMINATION MARGIN: {marginMs}ms (SAFE)
          </span>
        </div>
      </div>

      {/* Prominent Floating "FULL SELECTIVITY" Certification Badge */}
      <div
        style={{
          position: "absolute",
          top: "140px",
          right: "95px",
          transform: `scale(${badgeScale})`,
          opacity: badgeOpacity,
          background:
            "linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(2, 44, 34, 0.98) 100%)",
          border: "2px solid #10b981",
          boxShadow:
            "0 15px 40px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.45)",
          borderRadius: "12px",
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px #10b981",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#022c22"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                color: "#6ee7b7",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              COORDINATION CONFIRMED
            </span>
          </div>
          <span
            style={{
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            FULL SELECTIVITY (50.0 kA)
          </span>
          <span
            style={{
              color: "#a7f3d0",
              fontSize: "11px",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Schneider Masterpact MTZ1 / ComPacT NSX250
          </span>
        </div>
      </div>
    </div>
  );
};
