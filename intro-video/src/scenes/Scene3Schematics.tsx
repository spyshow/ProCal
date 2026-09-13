import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground } from "../components/AmbientBackground";
import { MonitorFrame } from "../components/MonitorFrame";
import { PulseEnergy } from "../components/PulseEnergy";
import { SceneHUD } from "../components/SceneHUD";

export const Scene3Schematics: React.FC = () => {
  const frame = useCurrentFrame();

  // Slow, elegant camera zoom into high-contrast electrical schematic
  const scale = interpolate(frame, [0, 135], [1.04, 1.22], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateX = interpolate(frame, [0, 135], [20, -30], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateY = interpolate(frame, [0, 135], [-15, 15], {
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
        imageSrc="assets/v2/sld.png"
        cameraStyle={{
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
        }}
      >
        <PulseEnergy />
      </MonitorFrame>

      <SceneHUD
        badge="03 // SCHEMATICS & RISERS"
        title="Single-Line & Vertical Riser Topologies"
        subtitle="Automated multi-floor riser generation with live busbar voltage drop tracking (ΔV < 4%)."
        accentColor="#38bdf8"
      />
    </div>
  );
};
