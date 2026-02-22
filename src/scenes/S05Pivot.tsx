import React from "react";
import { spring, interpolate, useCurrentFrame } from "remotion";

// S5 -- Pivot / "Then InTouch" · Type A dark · 105 frames (3.5s)

const GOLD = "#D4A574";
const FPS = 30;
const SOFT = { damping: 80, stiffness: 180, mass: 0.8 };
const SNAPPY = { damping: 90, stiffness: 260, mass: 0.7 };

function sp(frame: number, start: number, config = SOFT) {
  return spring({ frame: frame - start, fps: FPS, from: 0, to: 1, config });
}

// Word reveal: near-invisible → gold → past color
function wordStyle(
  frame: number,
  activationFrame: number,
  pastColor = "#666"
): React.CSSProperties {
  if (frame < activationFrame) return { color: "rgba(255,255,255,0.05)" };
  if (frame < activationFrame + 14) {
    const p = Math.min((frame - activationFrame) / 6, 1);
    return {
      color: GOLD,
      textShadow: `0 0 28px rgba(212,165,116,${(0.55 * p).toFixed(2)})`,
    };
  }
  return { color: pastColor };
}

// Subtitle words: 22 words starting at frame 65, spaced 2 frames apart
const SUB_WORDS = [
  { text: "Before", special: false },
  { text: "every", special: false },
  { text: "meeting", special: false },
  { text: "--", special: false },
  { text: "a", special: false },
  { text: "briefing.", special: true, boldColor: "#CCC" },
  { text: "The", special: false },
  { text: "path", special: true, boldColor: "#CCC" },
  { text: "out", special: false },
  { text: "of", special: false },
  { text: "my", special: false },
  { text: "garden,", special: false },
  { text: "and", special: false },
  { text: "exactly", special: false },
  { text: "who", special: true, boldColor: "#CCC" },
  { text: "to", special: false },
  { text: "ask", special: false },
  { text: "for.", special: false },
];

export function S05Pivot() {
  const frame = useCurrentFrame();

  const thenP = sp(frame, 0);

  // Main words activation frames
  const mainWords = [
    { text: "I", frame: 15 },
    { text: "started", frame: 19 },
    { text: "using", frame: 23 },
  ];

  // "InTouch." gets special treatment (gold, large)
  const inTouchFrame = 27;
  const inTouchP = sp(frame, inTouchFrame, SNAPPY);

  // Rule
  const ruleP = sp(frame, 42, SNAPPY);
  const ruleW = interpolate(ruleP, [0, 1], [0, 36]);

  // Badge
  const badgeP = sp(frame, 52);

  // Subtitle block fade-in (no word-by-word animation — word reveal stops at "InTouch.")
  const subP = sp(frame, 65);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0D0D0D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(212,165,116,0.07) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* "Then" label */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#282828",
          marginBottom: 22,
          opacity: thenP,
          position: "relative",
          zIndex: 1,
        }}
      >
        Then
      </div>

      {/* Main headline */}
      <div
        style={{
          fontFamily: "'IBM Plex Serif', serif",
          fontStyle: "italic",
          fontSize: 50,
          color: "#666",
          lineHeight: 1.3,
          position: "relative",
          zIndex: 1,
        }}
      >
        {mainWords.map(({ text, frame: af }) => (
          <span key={text} style={{ ...wordStyle(frame, af), marginRight: 12 }}>
            {text}
          </span>
        ))}
        {/* InTouch. — gold, Manrope, large */}
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontStyle: "normal",
            fontWeight: 800,
            fontSize: 66,
            color: GOLD,
            letterSpacing: "-0.03em",
            marginTop: 8,
            textShadow: "0 0 60px rgba(212,165,116,0.25)",
            opacity: inTouchP,
            transform: `scale(${interpolate(inTouchP, [0, 1], [0.92, 1])})`,
          }}
        >
          InTouch.
        </div>
      </div>

      {/* Rule */}
      <div
        style={{
          width: ruleW,
          height: 1,
          background: "rgba(212,165,116,0.3)",
          margin: "30px 0 24px",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "rgba(212,165,116,0.08)",
          border: "1px solid rgba(212,165,116,0.2)",
          borderRadius: 100,
          padding: "5px 14px",
          marginBottom: 12,
          position: "relative",
          zIndex: 1,
          opacity: badgeP,
          transform: `scale(${interpolate(badgeP, [0, 1], [0.94, 1])})`,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: GOLD,
            boxShadow: "0 0 6px rgba(212,165,116,0.5)",
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(212,165,116,0.7)",
          }}
        >
          The Strategic Ask Brief
        </span>
      </div>

      {/* Subtitle — entire block fades in together; no word-by-word reveal */}
      <div
        style={{
          fontFamily: "'IBM Plex Serif', serif",
          fontStyle: "italic",
          fontSize: 19,
          lineHeight: 1.6,
          maxWidth: 520,
          color: "#555",
          position: "relative",
          zIndex: 1,
          opacity: subP,
        }}
      >
        {SUB_WORDS.map(({ text, special, boldColor }, i) => (
          <span
            key={i}
            style={{
              color: special ? (boldColor as string) : "#555",
              fontStyle: special ? "normal" : "italic",
              fontWeight: special ? 700 : undefined,
              marginRight: 5,
            }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
