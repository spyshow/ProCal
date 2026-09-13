import "./index.css";
import React from "react";
import { Composition, Folder } from "remotion";
import { ProCalIntroVideo } from "./Composition";
import { ProCalReelVideo } from "./ReelComposition";
import { ProCalTutorialVideo } from "./TutorialComposition";
import { Scene1Workspace } from "./scenes/Scene1Workspace";
import { Scene2Calculator } from "./scenes/Scene2Calculator";
import { Scene3Schematics } from "./scenes/Scene3Schematics";
import { Scene4Coordination } from "./scenes/Scene4Coordination";
import { Scene5ReportsAndOutro } from "./scenes/Scene5ReportsAndOutro";
import { ReelScene1Workspace } from "./scenes/reel/ReelScene1Workspace";
import { ReelScene2Calculator } from "./scenes/reel/ReelScene2Calculator";
import { ReelScene3Schematics } from "./scenes/reel/ReelScene3Schematics";
import { ReelScene4Coordination } from "./scenes/reel/ReelScene4Coordination";
import { ReelScene5ReportsAndOutro } from "./scenes/reel/ReelScene5ReportsAndOutro";
import { Chapter1Overview } from "./scenes/tutorial/Chapter1Overview";
import { Chapter2Apartment } from "./scenes/tutorial/Chapter2Apartment";
import { Chapter3LibraryAndPanels } from "./scenes/tutorial/Chapter3LibraryAndPanels";
import { Chapter4RecalculateAndBalance } from "./scenes/tutorial/Chapter4RecalculateAndBalance";
import { Chapter5SurfacesVerification } from "./scenes/tutorial/Chapter5SurfacesVerification";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1. Main Full Tutorial Video with Captions (16:9, 48s) */}
      <Composition
        id="ProCalTutorial"
        component={ProCalTutorialVideo}
        durationInFrames={1440}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 2. Main Full Horizontal Intro Video Composition (16:9) */}
      <Composition
        id="ProCalIntro"
        component={ProCalIntroVideo}
        durationInFrames={660}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 2. Main Full Vertical Commercial Reel Composition (9:16) */}
      <Composition
        id="ProCalReel"
        component={ProCalReelVideo}
        durationInFrames={530}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Horizontal Scenes for preview and fine-tuning */}
      <Folder name="Horizontal-Scenes">
        <Composition
          id="Scene1-Workspace"
          component={Scene1Workspace}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene2-Calculator"
          component={Scene2Calculator}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene3-Schematics"
          component={Scene3Schematics}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene4-Coordination"
          component={Scene4Coordination}
          durationInFrames={135}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene5-ReportsAndOutro"
          component={Scene5ReportsAndOutro}
          durationInFrames={180}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>

      {/* Vertical Reel Scenes for mobile preview */}
      <Folder name="Reel-Scenes">
        <Composition
          id="Reel-Scene1"
          component={ReelScene1Workspace}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Reel-Scene2"
          component={ReelScene2Calculator}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Reel-Scene3"
          component={ReelScene3Schematics}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Reel-Scene4"
          component={ReelScene4Coordination}
          durationInFrames={110}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Reel-Scene5"
          component={ReelScene5ReportsAndOutro}
          durationInFrames={150}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>

      {/* Tutorial Chapters for preview and fine-tuning */}
      <Folder name="Tutorial-Chapters">
        <Composition
          id="Tutorial-Chapter1"
          component={Chapter1Overview}
          durationInFrames={250}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Tutorial-Chapter2"
          component={Chapter2Apartment}
          durationInFrames={315}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Tutorial-Chapter3"
          component={Chapter3LibraryAndPanels}
          durationInFrames={285}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Tutorial-Chapter4"
          component={Chapter4RecalculateAndBalance}
          durationInFrames={315}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Tutorial-Chapter5"
          component={Chapter5SurfacesVerification}
          durationInFrames={335}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};

