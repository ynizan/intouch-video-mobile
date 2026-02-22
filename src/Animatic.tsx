import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { SCENE_FRAMES } from "./Root";

import { S01Opening } from "./scenes/S01Opening";
import { S02Calendar } from "./scenes/S02Calendar";
import { S03LinkedIn } from "./scenes/S03LinkedIn";
import { S04Email } from "./scenes/S04Email";
import { S05Pivot } from "./scenes/S05Pivot";
import { S06Scan } from "./scenes/S06Scan";
import { S07Brief } from "./scenes/S07Brief";
import { S08Momentum } from "./scenes/S08Momentum";
import { S09Compounded } from "./scenes/S09Compounded";
import { S10Counter } from "./scenes/S10Counter";
import { S11EndCard } from "./scenes/S11EndCard";

// Background music toggle — set to true once audio/music.mp3 is placed in public/audio/
const MUSIC_ENABLED = true;

// Calculate cumulative start frames
const startFrames: number[] = [];
let acc = 0;
SCENE_FRAMES.forEach((f) => {
  startFrames.push(acc);
  acc += f;
});

export function Animatic() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Background music */}
      {MUSIC_ENABLED && (
        <Audio src={staticFile("audio/music.mp3")} volume={0.25} />
      )}

      {/* S1 — Opening */}
      <Sequence from={startFrames[0]} durationInFrames={SCENE_FRAMES[0]}>
        <S01Opening />
      </Sequence>

      {/* S2 — Closed Garden · Calendar */}
      <Sequence from={startFrames[1]} durationInFrames={SCENE_FRAMES[1]}>
        <Audio src={staticFile("audio/s2.mp3")} />
        <S02Calendar />
      </Sequence>

      {/* S3 — Network Limits · LinkedIn */}
      <Sequence from={startFrames[2]} durationInFrames={SCENE_FRAMES[2]}>
        <Audio src={staticFile("audio/s3.mp3")} />
        <S03LinkedIn />
      </Sequence>

      {/* S4 — Desperate Ask · Email */}
      <Sequence from={startFrames[3]} durationInFrames={SCENE_FRAMES[3]}>
        <Audio src={staticFile("audio/s4.mp3")} />
        <S04Email />
      </Sequence>

      {/* S5 — Then InTouch · Pivot */}
      <Sequence from={startFrames[4]} durationInFrames={SCENE_FRAMES[4]}>
        <Audio src={staticFile("audio/s5.mp3")} />
        <S05Pivot />
      </Sequence>

      {/* S6 — Network Scan */}
      <Sequence from={startFrames[5]} durationInFrames={SCENE_FRAMES[5]}>
        <Audio src={staticFile("audio/s6.mp3")} />
        <S06Scan />
      </Sequence>

      {/* S7 — Strategic Ask Brief */}
      <Sequence from={startFrames[6]} durationInFrames={SCENE_FRAMES[6]}>
        <Audio src={staticFile("audio/s7.mp3")} />
        <S07Brief />
      </Sequence>

      {/* S8 — Momentum */}
      <Sequence from={startFrames[7]} durationInFrames={SCENE_FRAMES[7]}>
        <Audio src={staticFile("audio/s8.mp3")} />
        <S08Momentum />
      </Sequence>

      {/* S9 — Compounded */}
      <Sequence from={startFrames[8]} durationInFrames={SCENE_FRAMES[8]}>
        <Audio src={staticFile("audio/s9.mp3")} />
        <S09Compounded />
      </Sequence>

      {/* S10 — The Number · Counter */}
      <Sequence from={startFrames[9]} durationInFrames={SCENE_FRAMES[9]}>
        <Audio src={staticFile("audio/s10.mp3")} />
        <S10Counter />
      </Sequence>

      {/* S11 — End Card */}
      <Sequence from={startFrames[10]} durationInFrames={SCENE_FRAMES[10]}>
        <Audio src={staticFile("audio/s11.mp3")} />
        <S11EndCard />
      </Sequence>
    </div>
  );
}
