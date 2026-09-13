import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface TutorialHeaderProps {
  stepNumber: number;
  totalSteps?: number;
  stepTitle: string;
  subtitle: string;
  badgeColor?: string;
}

export const TutorialHeader: React.FC<TutorialHeaderProps> = ({
  stepNumber,
  totalSteps = 5,
  stepTitle,
  subtitle,
  badgeColor = "#38bdf8",
}) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideDown = interpolate(frame, [0, 20], [-20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 36,
        left: 60,
        right: 60,
        zIndex: 90,
        opacity: fadeIn,
        transform: `translateY(${slideDown}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(11, 15, 25, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 18,
        padding: "16px 28px",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7)",
      }}
    >
      {/* Left: App Logo & Step Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingRight: 18,
            borderRight: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0284c7, #38bdf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(56, 189, 248, 0.5)",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>⚡</span>
          </div>
          <span
            style={{
              color: "#f8fafc",
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: "0.08em",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            PRO<span style={{ color: "#38bdf8" }}>CAL</span>
          </span>
        </div>

        {/* Step Badge */}
        <div
          style={{
            background: `rgba(56, 189, 248, 0.14)`,
            border: `1px solid ${badgeColor}66`,
            borderRadius: 8,
            padding: "4px 12px",
            color: badgeColor,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          STEP 0{stepNumber} OF 0{totalSteps}
        </div>

        {/* Titles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {stepTitle}
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "JetBrains Mono, monospace, sans-serif",
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      {/* Right: Step Dots Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const isCurrent = idx + 1 === stepNumber;
          const isDone = idx + 1 < stepNumber;
          return (
            <div
              key={idx}
              style={{
                width: isCurrent ? 28 : 10,
                height: 10,
                borderRadius: 5,
                background: isCurrent
                  ? badgeColor
                  : isDone
                  ? "#22c55e"
                  : "rgba(255, 255, 255, 0.18)",
                boxShadow: isCurrent ? `0 0 12px ${badgeColor}` : "none",
                transition: "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
