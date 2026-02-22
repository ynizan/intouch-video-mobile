#!/usr/bin/env python3
"""
Generate background music for the InTouch animatic.

Arc: slow ambient intro → builds midway → uplifting energetic finish.

  0  – 26s  Ambient pads only (BPM 90)
  26 – 30s  A→B crossfade: pads fade out, quarter arpeggio fades in
  30 – 35s  Pads gone, quarter-note arpeggio (BPM 97)
  35 – 40s  8th-notes enter (cross-fading from quarter), BPM 97
  40 – 45s  BPM rises to 106, high melody starts growing
  45 – 85s  Pads return (short, lower vol), 8th-note arpeggio + growing melody

Output:
    audio/music.mp3         (85 seconds, 128kbps MP3)
    public/audio/music.mp3  (copy for Remotion preview)

Re-run any time to regenerate.
"""

import os, shutil
import numpy as np
import scipy.io.wavfile
from pydub import AudioSegment

SR         = 44100
TARGET_SEC = 85.0
GEN_SEC    = TARGET_SEC + 3

# ── TIMELINE (seconds) ───────────────────────────────────────────────────────
T_AB_START  = 26.0   # pads begin fading, quarter arp begins entering
T_AB_END    = 30.0   # pads gone, quarter arp fully in
T_8TH       = 35.0   # 8th-note arpeggio fades in (replaces quarter over 3s)
T_TEMPO     = 40.0   # BPM jumps to 106, high melody starts growing
T_PADS_BACK = 45.0   # pads return (shorter env, lower vol)

# ── BPM / BEAT ───────────────────────────────────────────────────────────────
BPM_A = 90   # 0 – T_AB_END
BPM_B = 97   # T_AB_END – T_TEMPO
BPM_C = 106  # T_TEMPO – end

def get_beat(t: float) -> float:
    if t < T_AB_END:  return 60.0 / BPM_A
    if t < T_TEMPO:   return 60.0 / BPM_B
    return 60.0 / BPM_C

def get_chord_beats(t: float) -> int:
    return 8 if t < T_AB_END else 4   # long slow chords in A, shorter after

OUTPUT_MP3 = "audio/music.mp3"
PUBLIC_MP3 = "public/audio/music.mp3"
TMP_WAV    = "/tmp/music_raw.wav"

# ── NOTE UTILITIES ──────────────────────────────────────────────────────────

_SEMITONES = {
    'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,
    'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,
}

def freq(name: str) -> float:
    note   = name[:-1]
    octave = int(name[-1])
    midi   = 12 * (octave + 1) + _SEMITONES[note]
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)

# ── SYNTHESIS PRIMITIVES ─────────────────────────────────────────────────────

def sine(f: float, n_samples: int, phase=0.0) -> np.ndarray:
    t = np.arange(n_samples) / SR
    return np.sin(2 * np.pi * f * t + phase)

def pad_tone(f: float, n: int, atk=0.4, rel=0.6, harmonics=None) -> np.ndarray:
    """Warm, slightly detuned pad tone."""
    if harmonics is None:
        harmonics = [(1, 1.0), (2, 0.35), (3, 0.15), (4, 0.06), (5, 0.02)]
    # slight detune for chorus effect
    wave = sum(amp * (sine(f * h, n) + 0.18 * sine(f * h * 1.003, n))
               for h, amp in harmonics)
    wave /= (1.18 * sum(a for _, a in harmonics))

    env = np.ones(n)
    a = min(int(SR * atk), n)
    r = min(int(SR * rel), n - a)
    if a > 0:
        env[:a] = np.linspace(0, 1, a)
    if r > 0:
        env[-r:] = np.linspace(1, 0, r)
    return wave * env

def bright_tone(f: float, n: int, atk=0.01, rel=0.25) -> np.ndarray:
    """Bright plucky tone for arpeggios / melody."""
    harmonics = [(1, 1.0), (2, 0.6), (3, 0.35), (4, 0.18), (5, 0.08), (6, 0.03)]
    wave = sum(amp * sine(f * h, n) for h, amp in harmonics)
    wave /= sum(a for _, a in harmonics)

    env = np.ones(n)
    a = min(int(SR * atk), n)
    r = min(int(SR * rel), n - a)
    env[:a] = np.linspace(0, 1, a)
    # exponential decay — pluck character
    decay_n = n - a
    if decay_n > 0:
        decay = np.exp(-np.linspace(0, 5, decay_n))
        env[a:] = decay
    return wave * env

def bass_tone(f: float, n: int) -> np.ndarray:
    harmonics = [(1, 1.0), (2, 0.4), (3, 0.12)]
    wave = sum(amp * sine(f * h, n) for h, amp in harmonics)
    wave /= sum(a for _, a in harmonics)

    env = np.ones(n)
    atk = min(int(SR * 0.06), n)
    rel = min(int(SR * 0.5), n - atk)
    env[:atk] = np.linspace(0, 1, atk)
    env[-rel:] = np.linspace(1, 0, rel)
    return wave * env

# ── REVERB ──────────────────────────────────────────────────────────────────

def reverb(sig: np.ndarray, wet=0.30) -> np.ndarray:
    combs = [(29.7, 0.805), (37.1, 0.827), (41.1, 0.783), (43.7, 0.764)]
    rev = np.zeros_like(sig, dtype=float)
    for ms, decay in combs:
        d = int(SR * ms / 1000)
        r = sig.astype(float).copy()
        for i in range(d, len(r)):
            r[i] += r[i - d] * decay
        rev += r
    rev /= max(np.max(np.abs(rev)), 1e-9)
    # simple allpass
    d2 = int(SR * 0.005)
    for i in range(d2, len(rev)):
        rev[i] += -0.7 * rev[i - d2]
    return sig.astype(float) * (1 - wet) + rev * wet

# ── CHORD DEFINITIONS ────────────────────────────────────────────────────────
# C – Am – F – G  (one full bar per chord in section A; half-bar in sections B/C)

CHORDS = {
    'C':  {'pad': ['C3','G3','E4','G4'],  'bass': 'C2', 'arp': ['C4','E4','G4','C5']},
    'Am': {'pad': ['A2','E3','C4','E4'],  'bass': 'A2', 'arp': ['A3','C4','E4','A4']},
    'F':  {'pad': ['F2','C3','A3','C4'],  'bass': 'F2', 'arp': ['F3','A3','C4','F4']},
    'G':  {'pad': ['G2','D3','B3','D4'],  'bass': 'G2', 'arp': ['G3','B3','D4','G4']},
}

PROGRESSION = ['C', 'Am', 'F', 'G']

# ── TIME-BASED PARAMETER FUNCTIONS ──────────────────────────────────────────

def _lerp(v0, v1, t0, t1, t):
    """Linear interpolate between v0 and v1 as t goes from t0 to t1."""
    return v0 + (v1 - v0) * max(0.0, min(1.0, (t - t0) / (t1 - t0)))

def pad_vol(t: float) -> float:
    """Pad volume multiplier over time."""
    if t < T_AB_START:    return 1.0
    if t < T_AB_END:      return _lerp(1.0, 0.0, T_AB_START, T_AB_END, t)  # fade out
    if t < T_PADS_BACK:   return 0.0
    return 0.42                                                               # return, lower

def pad_env(t: float):
    """(attack, release) for pads — shorter and punchier in section C."""
    if t < T_PADS_BACK: return 0.5, 1.0
    return 0.18, 0.40   # short, tight on return

def bass_vol(t: float) -> float:
    """Bass follows pads but lingers a bit longer into the transition."""
    if t < T_AB_START:  return 1.0
    if t < T_AB_END + 3: return _lerp(1.0, 0.0, T_AB_START, T_AB_END + 3, t)
    if t < T_PADS_BACK: return 0.0
    return 0.42

def q_arp_vol(t: float) -> float:
    """Quarter-note arpeggio: enters 26-30s, fades out 35-38s."""
    if t < T_AB_START:   return 0.0
    if t < T_AB_END:     return _lerp(0.0, 0.22, T_AB_START, T_AB_END, t)   # fade in
    if t < T_8TH:        return 0.22                                           # full
    if t < T_8TH + 3.0:  return _lerp(0.22, 0.0, T_8TH, T_8TH + 3.0, t)    # fade out
    return 0.0

def e_arp_vol(t: float) -> float:
    """8th-note arpeggio: enters 35-38s, stays full through section C."""
    if t < T_8TH:        return 0.0
    if t < T_8TH + 3.0:  return _lerp(0.0, 0.24, T_8TH, T_8TH + 3.0, t)
    return 0.24

def melody_vol(t: float) -> float:
    """High melody: grows from T_TEMPO (40s) to end."""
    if t < T_TEMPO: return 0.0
    return _lerp(0.0, 0.17, T_TEMPO, TARGET_SEC, t)

# ── TRACK BUILDER ────────────────────────────────────────────────────────────

MELODY_MAP = {
    'C':  ['C5', 'G5'],
    'Am': ['A5', 'E5'],
    'F':  ['F5', 'C6'],
    'G':  ['G5', 'D6'],
}

def make_track() -> np.ndarray:
    total = int(SR * GEN_SEC)
    track = np.zeros(total)

    chord_idx = 0
    t = 0.0

    while t < GEN_SEC:
        name = PROGRESSION[chord_idx % len(PROGRESSION)]
        ch   = CHORDS[name]

        beat      = get_beat(t)
        chord_dur = min(beat * get_chord_beats(t), GEN_SEC - t)
        if chord_dur < 0.05:
            break
        cn = int(SR * chord_dur)

        # Use chord midpoint for smooth per-chord crossfades
        tm = t + chord_dur / 2

        # ── PADS ──
        pv = pad_vol(tm)
        if pv > 0.01:
            atk, rel = pad_env(tm)
            for note in ch['pad']:
                seg = pad_tone(freq(note), cn, atk=atk, rel=rel) * 0.28 * pv
                write(track, t, seg)

        # ── BASS ──
        bv = bass_vol(tm)
        if bv > 0.01:
            bseg = bass_tone(freq(ch['bass']), cn) * 0.14 * bv
            write(track, t, bseg)

        # ── QUARTER ARPEGGIO ──
        qv = q_arp_vol(tm)
        if qv > 0.01:
            step = beat
            for i in range(int(chord_dur / step)):
                nt = t + i * step
                if nt >= GEN_SEC: break
                nn = min(int(SR * step * 0.82), int(SR * 0.5))
                seg = bright_tone(freq(ch['arp'][i % 4]), nn, atk=0.01, rel=0.22) * qv
                write(track, nt, seg)

        # ── 8TH ARPEGGIO ──
        ev = e_arp_vol(tm)
        if ev > 0.01:
            step = beat / 2
            for i in range(int(chord_dur / step)):
                nt = t + i * step
                if nt >= GEN_SEC: break
                nn = min(int(SR * step * 0.75), int(SR * 0.28))
                seg = bright_tone(freq(ch['arp'][i % 4]), nn, atk=0.008, rel=0.16) * ev
                write(track, nt, seg)

        # ── HIGH MELODY (grows from T_TEMPO to end) ──
        mv = melody_vol(tm)
        if mv > 0.005:
            for mi, mn in enumerate(MELODY_MAP.get(name, [ch['arp'][-1]])):
                nt = t + mi * beat * 2
                if nt >= GEN_SEC: break
                nn = min(int(SR * beat * 1.5), int(SR * 0.9))
                seg = bright_tone(freq(mn), nn, atk=0.02, rel=0.5) * mv
                write(track, nt, seg)

        t += chord_dur
        chord_idx += 1

    # ── REVERB ──
    print("  applying reverb...")
    track = reverb(track, wet=0.32)

    # ── OVERALL VOLUME ARC (vectorised) ──
    ts   = np.arange(total) / SR
    gain = np.ones(total)
    # 26-40s: ramp 1.0 → 1.35
    m1 = (ts >= T_AB_START) & (ts < T_TEMPO)
    gain[m1] = 1.0 + 0.35 * np.clip((ts[m1] - T_AB_START) / (T_TEMPO - T_AB_START), 0, 1)
    # 40-85s: continue 1.35 → 1.55
    m2 = ts >= T_TEMPO
    gain[m2] = 1.35 + 0.20 * np.clip((ts[m2] - T_TEMPO) / (TARGET_SEC - T_TEMPO), 0, 1)
    track *= gain

    # ── NORMALIZE ──
    peak = np.max(np.abs(track))
    if peak > 0:
        track = track / peak * 0.88

    # ── GLOBAL FADES ──
    track[:int(SR * 4.0)] *= np.linspace(0, 1, int(SR * 4.0))
    track[-int(SR * 5.0):] *= np.linspace(1, 0, int(SR * 5.0))

    return (track * 32767).astype(np.int16)


def write(track: np.ndarray, t_sec: float, seg: np.ndarray):
    """Add seg into track starting at t_sec (safe boundary)."""
    start = int(SR * t_sec)
    end   = min(start + len(seg), len(track))
    if end <= start:
        return
    track[start:end] += seg[:end - start]


# ── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("Generating background music…")
    print(f"  0–{T_AB_START}s pads | {T_AB_START}–{T_AB_END}s A→B xfade | {T_AB_END}–{T_8TH}s quarter arp (BPM {BPM_B})")
    print(f"  {T_8TH}s 8ths enter | {T_TEMPO}s BPM→{BPM_C} + melody grows | {T_PADS_BACK}s pads return (short)")

    audio = make_track()

    scipy.io.wavfile.write(TMP_WAV, SR, audio)

    seg = AudioSegment.from_wav(TMP_WAV)[:int(TARGET_SEC * 1000)]
    os.makedirs("audio",        exist_ok=True)
    os.makedirs("public/audio", exist_ok=True)
    seg.export(OUTPUT_MP3, format="mp3", bitrate="128k")
    shutil.copy(OUTPUT_MP3, PUBLIC_MP3)

    print(f"\nDone — {len(seg)/1000:.1f}s")
    print(f"  {OUTPUT_MP3}")
    print(f"  {PUBLIC_MP3}")


if __name__ == "__main__":
    main()
