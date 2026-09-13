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

export const Chapter2Apartment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const leftSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const step1Spring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const step2Spring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const step3Spring = spring({
    frame: frame - 70,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Pan on screenshot
  const imgScale = interpolate(frame, [0, 315], [1.02, 1.08]);
  const imgTranslateY = interpolate(frame, [0, 315], [-10, -35]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b14", overflow: "hidden" }}>
      <AmbientBackground />

      <TutorialHeader
        stepNumber={2}
        stepTitle="Apartment Templates & Automated Feeder Sizing"
        subtitle="Rule: Σ connectedLoad/1000 × IEC Diversity  •  Engine: sizeCableAndBreaker()"
        badgeColor="#38bdf8"
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
        {/* Left Column: Authentic UI Screenshot */}
        <div
          style={{
            opacity: leftSpring,
            transform: `translateX(${(1 - leftSpring) * -30}px)`,
            height: "100%",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85), 0 0 30px rgba(56,189,248,0.12)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Window Header */}
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
                ApartmentTemplate: 3-Bedroom Deluxe (POST /api/templates)
              </span>
            </div>
            <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700 }}>
              AUTO-SYNCED
            </span>
          </div>

          {/* Screenshot Container */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <Img
              src={staticFile("assets/v2/buildings.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top left",
                transform: `scale(${imgScale}) translateY(${imgTranslateY}px)`,
              }}
            />

            {/* Overlay highlighted callout */}
            <div
              style={{
                position: "absolute",
                bottom: 18,
                left: 18,
                right: 18,
                background: "rgba(11, 15, 25, 0.88)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: 12,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <span style={{ color: "#f8fafc", fontSize: 12, fontWeight: 700 }}>
                  Rooms Configured: Living (4.2kW), Master (3.8kW), Kitchen (4.8kW), Bed 2 (2.0kW)
                </span>
              </div>
              <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 800 }}>
                Σ = 14.8 kW
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: 3 Automated Engineering Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", justifyContent: "center" }}>
          
          {/* Card 1: Room Sum & Template Load */}
          <div
            style={{
              opacity: step1Spring,
              transform: `translateX(${(1 - step1Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#0284c7", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  PHASE 1
                </span>
                <span style={{ color: "#f8fafc", fontSize: 16, fontWeight: 700 }}>
                  Connected Load Aggregation
                </span>
              </div>
              <span style={{ color: "#38bdf8", fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 800 }}>
                14.80 kW
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.4 }}>
              Queries template rooms: lighting (100W/circ), general power sockets, AC room-sizing model, and fixed appliances.
            </p>
          </div>

          {/* Card 2: IEC 60364 Diversity Engine */}
          <div
            style={{
              opacity: step2Spring,
              transform: `translateX(${(1 - step2Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(168, 85, 247, 0.35)",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#9333ea", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  PHASE 2
                </span>
                <span style={{ color: "#f8fafc", fontSize: 16, fontWeight: 700 }}>
                  IEC 60364 Apartment Diversity Factor
                </span>
              </div>
              <span style={{ color: "#c084fc", fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 800 }}>
                DF = 0.78  ➔  11.54 kW
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.4 }}>
              Dynamic diversity curve: 1 Apt (1.0), 2–4 Apts (0.78), 5–9 Apts (0.63), 10–14 Apts (0.53). Diversified demand calculated automatically.
            </p>
          </div>

          {/* Card 3: sizeCableAndBreaker Result */}
          <div
            style={{
              opacity: step3Spring,
              transform: `translateX(${(1 - step3Spring) * 30}px)`,
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#16a34a", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  PHASE 3
                </span>
                <span style={{ color: "#f8fafc", fontSize: 16, fontWeight: 700 }}>
                  sizeCableAndBreaker() Execution
                </span>
              </div>
              <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 800 }}>
                STANDARDS COMPLIANT
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>DESIGN CURRENT (Ib)</div>
                <div style={{ color: "#f8fafc", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono" }}>26.24 A (3-Phase)</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>RATED BREAKER (In)</div>
                <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono" }}>32A Type-C 10kA</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>RECOMMENDED CABLE</div>
                <div style={{ color: "#4ade80", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono" }}>4 × 6.0 mm² Cu/XLPE</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700 }}>VOLTAGE DROP (ΔV)</div>
                <div style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, fontFamily: "JetBrains Mono" }}>0.84% (&lt; 3.0% limit)</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AbsoluteFill>
  );
};
