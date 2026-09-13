import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ReelContainer } from "../../components/ReelContainer";
import { PulseEnergy } from "../../components/PulseEnergy";

export const ReelScene3Schematics: React.FC = () => {
  const frame = useCurrentFrame();

  // Downward panning camera following the energy distribution down the riser
  const zoomScale = interpolate(frame, [0, 110], [1.0, 1.05], {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 110], [0, -15], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 110], [0, -35], {
    extrapolateRight: "clamp",
  });

  return (
    <ReelContainer
      imageSrc="assets/v2/sld.png"
      category="🏢 VERTICAL SCHEMATICS"
      headline={
        <>
          Dynamic 400V <span style={{ color: "#f59e0b" }}>Vertical Risers</span>
        </>
      }
      subtitle="Automated Single-Line & Riser Schematics"
      featureTitle="Vertical Power Hierarchy & Tap-Off Telemetry"
      featureDescription="Visualize electrical distribution from the Main Switchboard up through multi-floor tap-off boxes with real-time voltage drop validation."
      highlights={[
        "400V TN-S Busbar Trunk",
        "Dynamic Voltage Drop",
        "Multi-Floor Tap-Offs",
        "Automatic Fault Trace",
      ]}
      sceneIndex={3}
      totalScenes={5}
      zoomScale={zoomScale}
      panX={panX}
      panY={panY}
    >
      <PulseEnergy />
    </ReelContainer>
  );
};
