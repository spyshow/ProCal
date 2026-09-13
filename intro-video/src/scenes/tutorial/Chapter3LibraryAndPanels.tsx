import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AmbientBackground } from "../../components/AmbientBackground";
import { TutorialHeader } from "../../components/tutorial/TutorialHeader";

export const Chapter3LibraryAndPanels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const rightSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const formulaSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 14, stiffness: 95 },
  });

  // Preset panels
  const presets = [
    {
      name: "PUMP_PANEL",
      title: "Booster / Fire Pump",
      icon: "💧",
      power: "7.5 kW",
      current: "13.5 A",
      breaker: "25A 3P MCB",
      color: "#0284c7",
    },
    {
      name: "ELEVATOR_PANEL",
      title: "Traction Elevator",
      icon: "🛗",
      power: "22.0 kW",
      current: "39.7 A",
      breaker: "63A 3P MCCB",
      color: "#8b5cf6",
    },
    {
      name: "SERVICE_PANEL",
      title: "Common Service Distribution",
      icon: "💡",
      power: "15.0 kW",
      current: "27.1 A",
      breaker: "40A 3P MCB",
      color: "#10b981",
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b14", overflow: "hidden" }}>
      <AmbientBackground />

      <TutorialHeader
        stepNumber={3}
        stepTitle="Load Library & Instant Manual Panels"
        subtitle="Formula: I = S / (√3 · V)  •  Direct Presets: SERVICE, PUMP & ELEVATOR PANELS"
        badgeColor="#a855f7"
      />

      <div
        style={{
          position: "absolute",
          top: 130,
          left: 60,
          right: 60,
          bottom: 110,
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* Left Column: Load Library Item & Server-Side Math */}
        <div
          style={{
            opacity: leftSpring,
            transform: `translateX(${(1 - leftSpring) * -30}px)`,
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(168, 85, 247, 0.35)",
            borderRadius: 20,
            padding: "26px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85), 0 0 30px rgba(168,85,247,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "rgba(168, 85, 247, 0.18)",
                  border: "1px solid rgba(168, 85, 247, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                📚
              </div>
              <div>
                <div style={{ color: "#c084fc", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em" }}>
                  PATH A: CATALOG ITEM
                </div>
                <div style={{ color: "#f8fafc", fontSize: 20, fontWeight: 800 }}>
                  Load Library Auto-Calculation
                </div>
              </div>
            </div>
            <span
              style={{
                background: "rgba(168, 85, 247, 0.15)",
                color: "#c084fc",
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "JetBrains Mono",
              }}
            >
              POST /api/loads
            </span>
          </div>

          {/* Library Item Card */}
          <div
            style={{
              background: "rgba(3, 7, 18, 0.6)",
              borderRadius: 14,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15 }}>
                Central Rooftop HVAC Chiller Unit
              </span>
              <span style={{ color: "#38bdf8", fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                3-Phase • 400V
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>RATED POWER</div>
                <div style={{ color: "#f8fafc", fontSize: 14, fontWeight: 800, fontFamily: "JetBrains Mono" }}>45.0 kW</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>POWER FACTOR</div>
                <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 800, fontFamily: "JetBrains Mono" }}>0.88 Lag</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", padding: "8px", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>DEMAND FACTOR</div>
                <div style={{ color: "#4ade80", fontSize: 14, fontWeight: 800, fontFamily: "JetBrains Mono" }}>0.90 DF</div>
              </div>
            </div>
          </div>

          {/* Real-time Current Calculation Box */}
          <div
            style={{
              opacity: formulaSpring,
              transform: `scale(${interpolate(formulaSpring, [0, 1], [0.95, 1])})`,
              background: "rgba(168, 85, 247, 0.08)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: 14,
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ color: "#e9d5ff", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
              ⚡ Server-Side 3-Phase Current Equation:
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 16,
                fontWeight: 700,
                color: "#f8fafc",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span>I = P / (√3 × V × PF)</span>
              <span style={{ color: "#c084fc" }}>➔</span>
              <span style={{ color: "#4ade80" }}>45,000 / (1.732 × 400 × 0.88) = 73.8 A</span>
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              Automatically configures 4 × 25 mm² Cu/XLPE cable and 100A 3P MCCB feeder.
            </div>
          </div>
        </div>

        {/* Right Column: 1-Click Manual Panel Presets */}
        <div
          style={{
            opacity: rightSpring,
            transform: `translateX(${(1 - rightSpring) * 30}px)`,
            background: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: 20,
            padding: "26px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85), 0 0 30px rgba(56,189,248,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em" }}>
                PATH B: DIRECT BOARDS
              </div>
              <div style={{ color: "#f8fafc", fontSize: 20, fontWeight: 800 }}>
                1-Click Manual Panel Insertion
              </div>
            </div>
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 800 }}>
              SANE DEFAULTS
            </span>
          </div>

          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
            Don’t need full room schedules? Drop specialized sub-distribution panels in one POST call:
          </p>

          {/* 3 Preset Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {presets.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(3, 7, 18, 0.6)",
                  border: `1px solid ${item.color}40`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <div>
                    <div style={{ color: "#f8fafc", fontSize: 14, fontWeight: 700 }}>
                      {item.title}
                    </div>
                    <div style={{ color: item.color, fontSize: 11, fontWeight: 700, fontFamily: "JetBrains Mono" }}>
                      type: "{item.name}"
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "right" }}>
                  <div>
                    <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                      {item.power}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                      Ib: {item.current}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "4px 8px",
                      color: "#4ade80",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {item.breaker}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(2, 132, 199, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: 10,
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              color: "#e0f2fe",
            }}
          >
            <span>💡</span>
            <span>Single API call: <code>POST /api/floors/[id]/items</code> with <code>type: "PUMP_PANEL"</code> creates and sizes board instantly.</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
