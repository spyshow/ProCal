import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const PulseEnergy: React.FC = () => {
  const frame = useCurrentFrame();

  // Exact coordinates matching Schematex SLD (v2/sld.png with objectFit:cover in 1680x880):
  // Scale factor = 880 / 916 = 0.9607
  // Incoming MDB feeder: X = 813px, Y: 250px -> 419px
  // Main horizontal busbar: top = 419px, left = 792px, width = 430px
  // Downstream branches: X1 = 962px, X2 = 1037px, X3 = 1112px, Y: 419px -> 595px

  // Incoming pulse down from MDB bus to F2 busbar
  const pulseInY = interpolate(frame % 40, [0, 40], [250, 419], {
    extrapolateRight: "clamp",
  });

  // Pulse along horizontal busbar (400V - F2)
  const pulseBusX = interpolate((frame + 12) % 40, [0, 40], [792, 1222], {
    extrapolateRight: "clamp",
  });

  // Downward branch pulses into downstream circuit breakers Wf2a, Wf2b, Wf2c
  const branch1Y = interpolate((frame + 20) % 36, [0, 36], [419, 595], {
    extrapolateRight: "clamp",
  });

  const branch2Y = interpolate((frame + 26) % 36, [0, 36], [419, 595], {
    extrapolateRight: "clamp",
  });

  const branch3Y = interpolate((frame + 32) % 36, [0, 36], [419, 595], {
    extrapolateRight: "clamp",
  });

  const glowPulse = interpolate(Math.sin(frame * 0.18), [-1, 1], [0.75, 1]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {/* 1. Main Incoming Feeder Conductor Glow (X = 813px) */}
      <div
        style={{
          position: "absolute",
          left: "813px",
          top: "250px",
          width: "3px",
          height: "169px",
          transform: "translateX(-50%)",
          background:
            "linear-gradient(180deg, rgba(245, 158, 11, 0.4) 0%, rgba(245, 158, 11, 0.9) 100%)",
          boxShadow: `0 0 16px rgba(245, 158, 11, ${glowPulse * 0.9})`,
        }}
      />

      {/* Travelling electrical packet: Incoming MDB Feeder */}
      <div
        style={{
          position: "absolute",
          left: "813px",
          top: `${pulseInY}px`,
          width: "8px",
          height: "22px",
          borderRadius: "4px",
          background: "#ffffff",
          boxShadow: "0 0 16px #f59e0b, 0 0 28px #ea580c",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* 2. Main 400V - F2 Horizontal Busbar Glow Beam (Y = 419px) */}
      <div
        style={{
          position: "absolute",
          left: "792px",
          top: "419px",
          width: "430px",
          height: "4px",
          background:
            "linear-gradient(90deg, rgba(245, 158, 11, 0.5) 0%, rgba(56, 189, 248, 0.9) 50%, rgba(245, 158, 11, 0.5) 100%)",
          boxShadow: `0 0 20px rgba(56, 189, 248, ${glowPulse * 0.9}), 0 0 35px rgba(245, 158, 11, 0.6)`,
        }}
      />

      {/* Travelling electrical packet: Horizontal Busbar */}
      <div
        style={{
          position: "absolute",
          left: `${pulseBusX}px`,
          top: "419px",
          width: "24px",
          height: "8px",
          borderRadius: "4px",
          background: "#ffffff",
          boxShadow: "0 0 16px #38bdf8, 0 0 28px #0284c7",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* 3. Downstream Feeder Branch Conductor Glows */}
      {/* Branch 1: Wf2a (X = 962px) */}
      <div
        style={{
          position: "absolute",
          left: "962px",
          top: "419px",
          width: "3px",
          height: "176px",
          transform: "translateX(-50%)",
          background: "rgba(56, 189, 248, 0.6)",
          boxShadow: "0 0 12px rgba(56, 189, 248, 0.7)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "962px",
          top: `${branch1Y}px`,
          width: "8px",
          height: "18px",
          borderRadius: "4px",
          background: "#ffffff",
          boxShadow: "0 0 14px #38bdf8",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Branch 2: Wf2b (X = 1037px) */}
      <div
        style={{
          position: "absolute",
          left: "1037px",
          top: "419px",
          width: "3px",
          height: "176px",
          transform: "translateX(-50%)",
          background: "rgba(56, 189, 248, 0.6)",
          boxShadow: "0 0 12px rgba(56, 189, 248, 0.7)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "1037px",
          top: `${branch2Y}px`,
          width: "8px",
          height: "18px",
          borderRadius: "4px",
          background: "#ffffff",
          boxShadow: "0 0 14px #38bdf8",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Branch 3: Wf2c (X = 1112px) */}
      <div
        style={{
          position: "absolute",
          left: "1112px",
          top: "419px",
          width: "3px",
          height: "176px",
          transform: "translateX(-50%)",
          background: "rgba(245, 158, 11, 0.6)",
          boxShadow: "0 0 12px rgba(245, 158, 11, 0.7)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "1112px",
          top: `${branch3Y}px`,
          width: "8px",
          height: "18px",
          borderRadius: "4px",
          background: "#ffffff",
          boxShadow: "0 0 14px #f59e0b",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Live Schematex SLD Status Badge */}
      <div
        style={{
          position: "absolute",
          top: "145px",
          right: "95px",
          background: "rgba(15, 23, 42, 0.94)",
          border: "1.5px solid rgba(56, 189, 248, 0.7)",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backdropFilter: "blur(12px)",
          boxShadow:
            "0 10px 25px rgba(0,0,0,0.7), 0 0 25px rgba(56, 189, 248, 0.35)",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            boxShadow: "0 0 10px #22c55e",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#e0f2fe",
              fontSize: "13px",
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.06em",
            }}
          >
            SCHEMATEX SLD ACTIVE • 400V TN-S
          </span>
          <span
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              fontFamily: "monospace",
            }}
          >
            CURRENT: 115.3 A • DEMAND: 35.9 kVA
          </span>
        </div>
      </div>
    </div>
  );
};
