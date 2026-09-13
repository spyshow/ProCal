import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";

interface MonitorFrameProps {
  imageSrc: string;
  cameraStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

export const MonitorFrame: React.FC<MonitorFrameProps> = ({
  imageSrc,
  cameraStyle,
  children,
}) => {
  const frame = useCurrentFrame();

  // Glass reflection glint moving subtly across the OLED monitor
  const glintOffset = interpolate(frame, [0, 150], [-100, 200], {
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
        perspective: 1400,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "1680px",
          height: "880px",
          borderRadius: "16px",
          backgroundColor: "#0b0f19",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow:
            "0 35px 80px -15px rgba(0, 0, 0, 0.95), 0 0 60px rgba(30, 58, 138, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
          position: "relative",
          overflow: "hidden",
          transformStyle: "preserve-3d",
          ...cameraStyle,
        }}
      >
        {/* The screen capture image */}
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top left",
            display: "block",
          }}
        />

        {/* Ambient OLED Glass Reflection Sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.04) 48%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.03) 53%, transparent 60%)`,
            transform: `translateX(${glintOffset}%)`,
            pointerEvents: "none",
          }}
        />

        {/* Subtle OLED border rim highlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "16px",
            border: "1px solid rgba(59, 130, 246, 0.15)",
            pointerEvents: "none",
          }}
        />

        {/* Child annotations, cursors, highlight overlays */}
        {children}
      </div>
    </div>
  );
};
