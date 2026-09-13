import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AmbientBackground } from "../../components/AmbientBackground";
import { TutorialHeader } from "../../components/tutorial/TutorialHeader";

export const Chapter1Overview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const card1Spring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const card2Spring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const card3Spring = spring({
    frame: frame - 34,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const apiSpring = spring({
    frame: frame - 50,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const cards = [
    {
      type: "APARTMENT",
      tag: "TEMPLATED BOARD",
      color: "#38bdf8",
      icon: "🏢",
      badge: "Full Room Schedule",
      sourceTitle: "ApartmentTemplate Rooms",
      formula: "Σ connectedLoad/1000 × Diversity",
      description: "Aggregates lighting, power sockets, AC units, and applies IEC 60364 diversity table.",
      springVal: card1Spring,
    },
    {
      type: "LIBRARY LOAD",
      tag: "CATALOG ITEM",
      color: "#a855f7",
      icon: "⚡",
      badge: "Pre-Engineered Spec",
      sourceTitle: "LoadLibraryItem Catalog",
      formula: "kW · Phase (1Ø/3Ø) · PF · DF",
      description: "Picks standard equipment with manufacturer rated power, demand factor, and phase count.",
      springVal: card2Spring,
    },
    {
      type: "MANUAL PANEL",
      tag: "DIRECT INSERTION",
      color: "#22c55e",
      icon: "🎛️",
      badge: "Sane Defaults",
      sourceTitle: "Service / Pump / Elevator Panel",
      formula: "Preset kW & Feeder Protection",
      description: "Quick-drop service panels (15kW), fire pumps (7.5kW), or elevator traction motors (22kW).",
      springVal: card3Spring,
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#070b14", overflow: "hidden" }}>
      <AmbientBackground />

      <TutorialHeader
        stepNumber={1}
        stepTitle="Load Classification & Selection"
        subtitle="Route: /calculator  •  API: POST /api/floors/[id]/items"
        badgeColor="#38bdf8"
      />

      {/* Main Container */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 60,
          right: 60,
          bottom: 110,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          justifyContent: "center",
        }}
      >
        {/* Title Banner */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <span
            style={{
              color: "#64748b",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "Inter, sans-serif",
            }}
          >
            ARCHITECTURE OVERVIEW
          </span>
          <h2
            style={{
              color: "#f8fafc",
              fontSize: 34,
              fontWeight: 800,
              fontFamily: "Inter, sans-serif",
              margin: "6px 0 0",
              letterSpacing: "-0.02em",
            }}
          >
            Three Item Kinds — <span style={{ color: "#38bdf8" }}>Pick the One Matching Your Load</span>
          </h2>
        </div>

        {/* 3 Cards Matrix */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          {cards.map((card, idx) => (
            <div
              key={idx}
              style={{
                opacity: card.springVal,
                transform: `translateY(${(1 - card.springVal) * 35}px)`,
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${card.color}33`,
                borderRadius: 20,
                padding: "26px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: `0 20px 40px -15px rgba(0,0,0,0.8), 0 0 25px ${card.color}15`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top ambient glow */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
                }}
              />

              {/* Card Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `${card.color}18`,
                      border: `1px solid ${card.color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    {card.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        color: card.color,
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {card.tag}
                    </div>
                    <div
                      style={{
                        color: "#f8fafc",
                        fontSize: 20,
                        fontWeight: 800,
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {card.type}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    color: "#94a3b8",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {card.badge}
                </div>
              </div>

              {/* Source & Formula Box */}
              <div
                style={{
                  background: "rgba(3, 7, 18, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                  Source: {card.sourceTitle}
                </div>
                <div
                  style={{
                    color: card.color,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {card.formula}
                </div>
              </div>

              {/* Description */}
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>
                {card.description}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Endpoint Banner */}
        <div
          style={{
            opacity: apiSpring,
            transform: `translateY(${(1 - apiSpring) * 20}px)`,
            background: "rgba(11, 15, 25, 0.9)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: 14,
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                background: "#0284c7",
                color: "#fff",
                borderRadius: 6,
                padding: "3px 8px",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              POST
            </span>
            <span
              style={{
                color: "#38bdf8",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              /api/floors/[id]/items
            </span>
            <span style={{ color: "#64748b", fontSize: 13, marginLeft: 8 }}>
              — Creates the board record, links template/spec, and triggers feeder computation
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 700 }}>● 201 Created</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>• Auto-Sizing Ready</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
