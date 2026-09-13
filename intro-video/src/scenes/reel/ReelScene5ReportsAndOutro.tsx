import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ReelContainer } from "../../components/ReelContainer";
import { ReelOutroCard } from "../../components/ReelOutroCard";

export const ReelScene5ReportsAndOutro: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera drift for report preview
  const zoomScale = interpolate(frame, [0, 55], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 55], [0, -40], {
    extrapolateRight: "clamp",
  });

  // Crossfade from report showcase to Outro Card at frame 48
  const reportOpacity = interpolate(frame, [45, 58], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outroOpacity = interpolate(frame, [48, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: "1080px",
        height: "1920px",
        backgroundColor: "#030712",
        overflow: "hidden",
      }}
    >
      {/* 1. Submittal Reports Preview (Frames 0 - 55) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: reportOpacity,
          pointerEvents: frame > 55 ? "none" : "auto",
        }}
      >
        <ReelContainer
          imageSrc="assets/v2/report.png"
          category="📑 ENGINEERING REPORTS"
          headline={
            <>
              Submittal-Ready <span style={{ color: "#60a5fa" }}>Calculations</span>
            </>
          }
          subtitle="IEC 60364-5-52 & BS 7671 Verification Sheets"
          featureTitle="Complete Submittal Packages & Schedules"
          featureDescription="Export comprehensive voltage drop, short-circuit, and breaker schedules ready for municipal authority submission."
          highlights={[
            "Authority Submittals",
            "Full Cable Schedules",
            "Voltage Drop Logs",
            "1-Click PDF Export",
          ]}
          sceneIndex={5}
          totalScenes={5}
          zoomScale={zoomScale}
          panY={panY}
        />
      </div>

      {/* 2. Full-Screen Vertical Outro Card (Frames 48 - 150) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: outroOpacity,
          pointerEvents: frame < 55 ? "none" : "auto",
        }}
      >
        <ReelOutroCard />
      </div>
    </div>
  );
};
