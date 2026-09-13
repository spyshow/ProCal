import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Scene1Workspace } from "./scenes/Scene1Workspace";
import { Scene2Calculator } from "./scenes/Scene2Calculator";
import { Scene3Schematics } from "./scenes/Scene3Schematics";
import { Scene4Coordination } from "./scenes/Scene4Coordination";
import { Scene5ReportsAndOutro } from "./scenes/Scene5ReportsAndOutro";

export const ProCalIntroVideo: React.FC = () => {
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
        <TransitionSeries.Sequence durationInFrames={135}>
          <Scene1Workspace />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 2: Live Phase Balancing & Calculation Engine */}
        <TransitionSeries.Sequence durationInFrames={135}>
          <Scene2Calculator />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 3: Single-Line & Vertical Riser Diagrams */}
        <TransitionSeries.Sequence durationInFrames={135}>
          <Scene3Schematics />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 4: Interactive TCC Curves & Breakers */}
        <TransitionSeries.Sequence durationInFrames={135}>
          <Scene4Coordination />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Scene 5: Submittal Reports & Outro */}
        <TransitionSeries.Sequence durationInFrames={180}>
          <Scene5ReportsAndOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </div>
  );
};
