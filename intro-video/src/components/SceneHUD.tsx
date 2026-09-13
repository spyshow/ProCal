import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

interface SceneHUDProps {
  badge: string;
  title: string;
  subtitle: string;
  accentColor?: string;
}

export const SceneHUD: React.FC<SceneHUDProps> = ({
  badge,
  title,
  subtitle,
  accentColor = "#f97316", // ProCal orange default
}) => {
  const frame = useCurrentFrame();

  // Entrance spring animation
  const translateY = interpolate(frame, [5, 30], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const opacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const barWidth = interpolate(frame, [10, 40], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: "48px",
        left: "56px",
        zIndex: 50,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background:
            "linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(3, 7, 18, 0.94) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow:
            "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(249, 115, 22, 0.12)",
          borderRadius: "14px",
          padding: "16px 24px",
          maxWidth: "700px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated glowing accent line at the bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "3px",
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${accentColor}, #3b82f6)`,
            boxShadow: `0 0 12px ${accentColor}`,
          }}
        />

        {/* Category Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(249, 115, 22, 0.14)",
              border: `1px solid ${accentColor}55`,
              borderRadius: "20px",
              padding: "3px 10px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
              }}
            />
            <span
              style={{
                color: "#ffedd5",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {badge}
            </span>
          </div>

          <span
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            IEC 60364 & BS 7671 COMPLIANT
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            color: "#ffffff",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            color: "#cbd5e1",
            fontSize: "14px",
            fontWeight: 400,
            margin: 0,
            lineHeight: 1.4,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
};
