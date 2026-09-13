import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();

  // Entrance starts at frame 88
  const opacity = interpolate(frame, [88, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [88, 120], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const dividerWidth = interpolate(frame, [100, 135], [0, 420], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const pillsOpacity = interpolate(frame, [115, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* Background Dimming Backdrop with blur */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(3, 7, 18, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      />

      {/* Center Cinematic Card */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${scale})`,
          padding: "52px 70px",
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.99) 100%)",
          border: "1px solid rgba(249, 115, 22, 0.4)",
          borderRadius: "30px",
          boxShadow:
            "0 30px 90px rgba(0, 0, 0, 0.95), 0 0 80px rgba(249, 115, 22, 0.25)",
          textAlign: "center",
          maxWidth: "880px",
        }}
      >
        {/* Glow ambient bulb */}
        <div
          style={{
            position: "absolute",
            width: "300px",
            height: "140px",
            top: "20px",
            background:
              "radial-gradient(circle, rgba(249, 115, 22, 0.45) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* ProCal Lightning Icon Badge */}
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "24px",
            background: "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 12px 35px rgba(234, 88, 12, 0.55), 0 0 45px rgba(249, 115, 22, 0.45)",
            marginBottom: "24px",
          }}
        >
          <svg
            width="50"
            height="50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>

        {/* App Title */}
        <h1
          style={{
            fontSize: "68px",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            margin: 0,
            fontFamily: "system-ui, -apple-system, sans-serif",
            textShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          ProCal
        </h1>

        {/* Animated Accent Divider */}
        <div
          style={{
            width: `${dividerWidth}px`,
            height: "3px",
            background:
              "linear-gradient(90deg, transparent 0%, #f97316 50%, transparent 100%)",
            boxShadow: "0 0 14px #f97316",
            margin: "20px 0 18px 0",
          }}
        />

        {/* Main Tagline */}
        <p
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#ffedd5",
            letterSpacing: "-0.01em",
            margin: "0 0 26px 0",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textShadow: "0 2px 12px rgba(234, 88, 12, 0.35)",
          }}
        >
          Low-Voltage Design, Solved.
        </p>

        {/* Feature Pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            opacity: pillsOpacity,
            marginBottom: "30px",
          }}
        >
          {[
            "Phase Balancing",
            "Selectivity & TCC",
            "Cable Schedules",
            "Vertical Risers",
            "Submittal Packages",
          ].map((feature) => (
            <span
              key={feature}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f1f5f9",
                fontSize: "14px",
                fontWeight: 600,
                padding: "8px 16px",
                borderRadius: "20px",
                fontFamily: "system-ui, sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Engineering Standards Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#94a3b8",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span style={{ color: "#f97316", fontWeight: 700 }}>●</span>
          IEC 60364 • BS 7671 • NFPA 70 • Schneider / ABB Catalog Integrated
        </div>
      </div>
    </div>
  );
};
