import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground } from "../components/AmbientBackground";
import { MonitorFrame } from "../components/MonitorFrame";
import { OutroCard } from "../components/OutroCard";
import { SceneHUD } from "../components/SceneHUD";

export const Scene5ReportsAndOutro: React.FC = () => {
  const frame = useCurrentFrame();

  // Smooth pull-back camera motion revealing submittal preview
  const scale = interpolate(frame, [0, 85], [1.16, 1.01], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const translateY = interpolate(frame, [0, 85], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Dimming the screen as outro card centers (starts at frame 85)
  const screenDimOpacity = interpolate(frame, [80, 110], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const screenBlur = interpolate(frame, [80, 115], [0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // HUD fades out before OutroCard arrives
  const hudOpacity = interpolate(frame, [70, 85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <AmbientBackground />

      <div
        style={{
          width: "100%",
          height: "100%",
          opacity: screenDimOpacity,
          filter: `blur(${screenBlur}px)`,
        }}
      >
        <MonitorFrame
          imageSrc="assets/v2/report.png"
          cameraStyle={{
            transform: `scale(${scale}) translateY(${translateY}px)`,
          }}
        >
          {/* Subtle glowing highlight on the PDF Download button */}
          <div
            style={{
              position: "absolute",
              top: "135px",
              right: "210px",
              width: "215px",
              height: "46px",
              borderRadius: "8px",
              border: "2px solid #ea580c",
              boxShadow: "0 0 24px #f97316",
              pointerEvents: "none",
            }}
          />
        </MonitorFrame>
      </div>

      {/* First half lower-third HUD */}
      <div style={{ opacity: hudOpacity }}>
        <SceneHUD
          badge="05 // SUBMITTALS & BOM"
          title="Authority-Ready Engineering Submittals"
          subtitle="Generate complete IEC 60364 compliant calculation reports and printable packages in one click."
          accentColor="#ea580c"
        />
      </div>

      {/* Outro Title Card */}
      <OutroCard />
    </div>
  );
};
