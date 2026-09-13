import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground } from "../components/AmbientBackground";
import { MonitorFrame } from "../components/MonitorFrame";
import { SceneHUD } from "../components/SceneHUD";
import { TCCScanline } from "../components/TCCScanline";

export const Scene4Coordination: React.FC = () => {
  const frame = useCurrentFrame();

  // Macro close-up tracking shot gliding across dynamic logarithmic TCC curves
  const scale = interpolate(frame, [0, 135], [1.10, 1.24], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateX = interpolate(frame, [0, 135], [70, -70], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateY = interpolate(frame, [0, 135], [15, -15], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
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

      <MonitorFrame
        imageSrc="assets/v2/TCC.png"
        cameraStyle={{
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      >
        <TCCScanline />
      </MonitorFrame>

      <SceneHUD
        badge="04 // PROTECTION & TCC"
        title="Interactive TCC Curves & Selectivity Studio"
        subtitle="Logarithmic time-current coordination with Schneider Masterpact & ComPacT trip-unit verification."
        accentColor="#10b981"
      />
    </div>
  );
};
