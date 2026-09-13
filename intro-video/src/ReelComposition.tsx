import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { ReelScene1Workspace } from "./scenes/reel/ReelScene1Workspace";
import { ReelScene2Calculator } from "./scenes/reel/ReelScene2Calculator";
import { ReelScene3Schematics } from "./scenes/reel/ReelScene3Schematics";
import { ReelScene4Coordination } from "./scenes/reel/ReelScene4Coordination";
import { ReelScene5ReportsAndOutro } from "./scenes/reel/ReelScene5ReportsAndOutro";

export const ProCalReelVideo: React.FC = () => {
  const transitionDuration = 15;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#030712",
      }}
    >
      <TransitionSeries>
        {/* Scene 1: The Modern Electrical Workspace */}
        <TransitionSeries.Sequence durationInFrames={110}>
          <ReelScene1Workspace />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 2: Live Phase Balancing & Calculation Engine */}
        <TransitionSeries.Sequence durationInFrames={110}>
          <ReelScene2Calculator />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 3: Single-Line & Vertical Riser Diagrams */}
        <TransitionSeries.Sequence durationInFrames={110}>
          <ReelScene3Schematics />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 4: Interactive TCC Curves & Breakers */}
        <TransitionSeries.Sequence durationInFrames={110}>
          <ReelScene4Coordination />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 5: Submittal Reports & Outro */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <ReelScene5ReportsAndOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </div>
  );
};
