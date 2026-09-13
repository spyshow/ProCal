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

export const Chapter4RecalculateAndBalance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const card1Spring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const card2Spring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const card3Spring = spring({
    frame: frame - 70,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const imgScale = interpolate(frame, [0, 315], [1.02, 1.07]);
  const imgTranslateY = interpolate(frame, [0, 315], [-5, -25]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b14", overflow: "hidden" }}>
      <AmbientBackground />

      <TutorialHeader
        stepNumber={4}
        stepTitle="Diversity Recalculation & Greedy Phase Balancing"
        subtitle="POST /api/buildings/[id]/recalculate  •  POST /api/floors/[id]/rebalance (Pin-Safe)"
        badgeColor="#22c55e"
      />

      <div
        style={{
          position: "absolute",
          top: 120,
          left: 60,
          right: 60,
          bottom: 130,
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 28,
          alignItems: "center",
        }}
      >
        {/* Left Column: Authentic /calculator Screenshot */}
        <div
          style={{
            opacity: leftSpring,
            transform: `translateX(${(1 - leftSpring) * -30}px)`,
            height: "100%",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85), 0 0 30px rgba(34,197,94,0.12)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 40,
              background: "rgba(11, 15, 25, 0.95)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  marginLeft: 8,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                /calculator — Live Phase Currents & Neutral Vector
              </span>
            </div>
            <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>
              BALANCED (0.4% Unbalance)
            </span>
          </div>

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Img
              src={staticFile("assets/v2/loads.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                transform: `scale(${imgScale}) translateY(${imgTranslateY}px)`,
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: 18,
                left: 18,
                right: 18,
                background: "rgba(11, 15, 25, 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                borderRadius: 12,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#ef4444", fontWeight: 800, fontFamily: "JetBrains Mono" }}>L1: 124.5A</span>
                <span style={{ color: "#f59e0b", fontWeight: 800, fontFamily: "JetBrains Mono" }}>L2: 123.8A</span>
                <span style={{ color: "#38bdf8", fontWeight: 800, fontFamily: "JetBrains Mono" }}>L3: 124.1A</span>
              </div>
              <span style={{ color: "#4ade80", fontWeight: 800, fontFamily: "JetBrains Mono" }}>
                Neutral (In): 0.4 A
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: 3 Critical Engineering Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", justifyContent: "center" }}>
          
          {/* Feature 1: Recalculate Stale Diversity */}
          <div
            style={{
              opacity: card1Spring,
              transform: `translateX(${(1 - card1Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#0284c7", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  STEP 1
                </span>
                <span style={{ color: "#f8fafc", fontSize: 15, fontWeight: 700 }}>
                  Stale Diversity Recalculation
                </span>
              </div>
              <span style={{ color: "#38bdf8", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700 }}>
                /api/buildings/[id]/recalculate
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              When floors or loads are added/deleted, clicking "Recalculate All Floors" refreshes building-wide IEC diversity factors and updates downstream feeders.
            </p>
          </div>

          {/* Feature 2: Greedy Auto-Assignment on Read */}
          <div
            style={{
              opacity: card2Spring,
              transform: `translateX(${(1 - card2Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#16a34a", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  STEP 2
                </span>
                <span style={{ color: "#f8fafc", fontSize: 15, fontWeight: 700 }}>
                  Greedy Phase Balancing Engine
                </span>
              </div>
              <span style={{ color: "#4ade80", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700 }}>
                computePhaseBalance()
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              Evaluates current on L1, L2, L3 dynamically. Minimizes neutral vector unbalance to prevent neutral overheating and harmonic accumulation.
            </p>
          </div>

          {/* Feature 3: Manual Pin Preservation Contract */}
          <div
            style={{
              opacity: card3Spring,
              transform: `translateX(${(1 - card3Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(245,158,11,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#d97706", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  STEP 3
                </span>
                <span style={{ color: "#f8fafc", fontSize: 15, fontWeight: 700 }}>
                  Manual Phase Pin Retention
                </span>
              </div>
              <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 800 }}>
                PIN-SAFE PERSISTENCE
              </span>
            </div>

            <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📌</span>
                <span style={{ color: "#f8fafc", fontSize: 13, fontWeight: 600 }}>
                  Apt 304 Locked to Phase L2
                </span>
              </div>
              <span style={{ color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700 }}>
                POST /api/floors/[id]/rebalance
              </span>
            </div>

            <p style={{ color: "#94a3b8", fontSize: 12, margin: "8px 0 0", lineHeight: 1.4 }}>
              Rebalance preserves all manual pins; only floating loads are rearranged. Pass <code>clearPins: true</code> to reset all pins to automatic.
            </p>
          </div>

        </div>
      </div>
    </AbsoluteFill>
  );
};
