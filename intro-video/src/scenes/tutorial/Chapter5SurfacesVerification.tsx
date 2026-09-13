import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AmbientBackground } from "../../components/AmbientBackground";
import { TutorialHeader } from "../../components/tutorial/TutorialHeader";

export const Chapter5SurfacesVerification: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrances
  const gridSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Outro transition starting at frame 210
  const outroProgress = interpolate(frame, [205, 235], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoSpring = spring({
    frame: frame - 215,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const surfaces = [
    {
      title: "/calculator — Load Balancing",
      subtitle: "Per-floor & building summary table, phase currents, and neutral vector.",
      img: "assets/v2/loads.png",
      color: "#38bdf8",
      icon: "⚡",
    },
    {
      title: "/panel — Panel Schedules",
      subtitle: "Full circuit schedules, poles, trips, and feeder incoming breakers.",
      img: "assets/v2/panel.png",
      color: "#a855f7",
      icon: "🎛️",
    },
    {
      title: "/sld — Single-Line Diagram",
      subtitle: "Schematex interactive electrical schematics with upstream substation.",
      img: "assets/v2/sld.png",
      color: "#22c55e",
      icon: "📐",
    },
    {
      title: "/reports — Submittal Sheets",
      subtitle: "One-click export of calculation reports, cable schedules, and compliance docs.",
      img: "assets/v2/report.png",
      color: "#f59e0b",
      icon: "📑",
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b14", overflow: "hidden" }}>
      <AmbientBackground />

      {/* Header during verification phase */}
      <div style={{ opacity: 1 - outroProgress }}>
        <TutorialHeader
          stepNumber={5}
          stepTitle="Quad-Surface Synchronization & Verification"
          subtitle="Single Source of Truth: All 4 surfaces read computeFeeders() concurrently"
          badgeColor="#38bdf8"
        />
      </div>

      {/* 4 Surfaces Grid */}
      <div
        style={{
          position: "absolute",
          top: 125,
          left: 60,
          right: 60,
          bottom: 110,
          opacity: (1 - outroProgress) * gridSpring,
          transform: `scale(${interpolate(gridSpring, [0, 1], [0.96, 1])}) translateY(${
            outroProgress * -40
          }px)`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 20,
        }}
      >
        {surfaces.map((item, idx) => (
          <div
            key={idx}
            style={{
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(14px)",
              border: `1px solid ${item.color}35`,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 15px 35px -10px rgba(0,0,0,0.8)",
            }}
          >
            {/* Surface Header */}
            <div
              style={{
                height: 38,
                background: "rgba(11, 15, 25, 0.95)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{item.icon}</span>
                <span
                  style={{
                    color: "#f8fafc",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {item.title}
                </span>
              </div>
              <span
                style={{
                  color: "#22c55e",
                  fontSize: 11,
                  fontWeight: 800,
                  background: "rgba(34, 197, 94, 0.12)",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                ✓ IN SYNC
              </span>
            </div>

            {/* Surface Image & Overlay */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <Img
                src={staticFile(item.img)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top left",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "linear-gradient(0deg, rgba(7, 11, 20, 0.92) 0%, rgba(7, 11, 20, 0.2) 100%)",
                  padding: "10px 14px",
                  color: "#94a3b8",
                  fontSize: 11,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {item.subtitle}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Outro Overlay Card */}
      {frame > 200 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: outroProgress,
            pointerEvents: "none",
            background: `radial-gradient(circle at center, rgba(15, 23, 42, ${0.95 * outroProgress}) 0%, rgba(3, 7, 18, ${
              0.98 * outroProgress
            }) 100%)`,
          }}
        >
          <div
            style={{
              transform: `scale(${interpolate(logoSpring, [0, 1], [0.85, 1])})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              textAlign: "center",
            }}
          >
            {/* Glowing Icon */}
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                background: "linear-gradient(135deg, #0284c7, #38bdf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 50px rgba(56, 189, 248, 0.6), 0 20px 40px rgba(0,0,0,0.8)",
              }}
            >
              <span style={{ fontSize: 42 }}>⚡</span>
            </div>

            {/* Brand Title */}
            <div>
              <h1
                style={{
                  fontSize: 54,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: "#f8fafc",
                  margin: 0,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                PRO<span style={{ color: "#38bdf8" }}>CAL</span>
              </h1>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#94a3b8",
                  margin: "8px 0 0",
                  letterSpacing: "-0.01em",
                }}
              >
                Low-Voltage Electrical Design, <span style={{ color: "#38bdf8" }}>Solved.</span>
              </p>
            </div>

            {/* Feature Pills */}
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              {["IEC 60364 Engine", "Greedy Phase Balancing", "Real-Time SLD", "One-Click Submittals"].map(
                (badge, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(56, 189, 248, 0.1)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      borderRadius: 100,
                      padding: "8px 18px",
                      color: "#e0f2fe",
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {badge}
                  </div>
                ),
              )}
            </div>

            {/* Web Link */}
            <div
              style={{
                marginTop: 10,
                color: "#64748b",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "0.05em",
              }}
            >
              procal.engineering  •  Modern Engineering Suite
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
