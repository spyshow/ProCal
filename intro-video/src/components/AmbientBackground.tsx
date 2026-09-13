import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const AmbientBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const glowX = interpolate(frame, [0, 660], [25, 35], {
    extrapolateRight: "clamp",
  });
  const glowY = interpolate(frame, [0, 660], [20, 30], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#030712",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {/* Deep technical grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: -100,
          backgroundImage:
            "linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.7,
        }}
      />

      {/* Cinematic blue ambient light sweep */}
      <div
        style={{
          position: "absolute",
          width: "1200px",
          height: "900px",
          top: "-200px",
          right: "-150px",
          borderRadius: "50%",
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(37, 99, 235, 0.28) 0%, rgba(30, 58, 138, 0.12) 45%, transparent 75%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle ProCal orange ambient warmth */}
      <div
        style={{
          position: "absolute",
          width: "900px",
          height: "700px",
          bottom: "-250px",
          left: "-150px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(234, 88, 12, 0.18) 0%, rgba(180, 83, 9, 0.06) 50%, transparent 75%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      {/* Top and Bottom cinematic letterbox vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(3, 7, 18, 0.6) 80%, rgba(3, 7, 18, 0.95) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
