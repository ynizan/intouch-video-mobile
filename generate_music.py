#!/usr/bin/env python3
"""
Generate background music for the InTouch animatic.

Arc: slow ambient intro → builds midway → uplifting energetic finish.

  0 – 28s   Ambient pads only (BPM 90, long 8-beat chords)
  28 – 45s  Pads fade out, arpeggio fades in, BPM ramps to ~97
  45 – 85s  Pads return at low volume, 8th-note arpeggio + melody, BPM ~106

Output:
    audio/music.mp3         (85 seconds, 128kbps MP3)
    public/audio/music.mp3  (copy for Remotion preview)

Re-run any time to regenerate.
"""

import os, shutil
import numpy as np
import scipy.io.wavfile
from pydub import AudioSegment

SR          = 44100
TARGET_SEC  = 85.0
GEN_SEC     = TARGET_SEC + 3

# Per-section BPM (arpeggios get faster each section)
BPM_A  = 90                        # 0–28s  pads only
BPM_B  = 97                        # 28–45s transition (+8%)
BPM_C  = 106                       # 45–85s uplifting (+18%)

BEAT_A = 60.0 / BPM_A              # 0.667s
BEAT_B = 60.0 / BPM_B              # 0.619s
BEAT_C = 60.0 / BPM_C              # 0.566s

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

# ── SECTION BOUNDARIES ───────────────────────────────────────────────────────

SEC_A_END = 28.0   # pads only
SEC_B_END = 45.0   # transition: pads fade out, arpeggio fades in
# SEC_C = 45 → 85s  pads back at low vol, 8th-note arpeggio + melody

# ── TRACK BUILDER ────────────────────────────────────────────────────────────

def section_params(t: float):
    """Return (beat, chord_beats) for the section at time t."""
    if t < SEC_A_END:
        return BEAT_A, 8           # long 8-beat chords, slow
    elif t < SEC_B_END:
        return BEAT_B, 4           # 4-beat chords, BPM 97
    else:
        return BEAT_C, 4           # 4-beat chords, BPM 106


def pad_fade(t: float) -> float:
    """Pad volume multiplier: 1.0 in A, fades to 0 across B, returns to 0.55 in C."""
    if t < SEC_A_END:
        return 1.0
    elif t < SEC_B_END:
        # linear fade from 1.0 → 0.0
        progress = (t - SEC_A_END) / (SEC_B_END - SEC_A_END)
        return 1.0 - progress
    else:
        return 0.55   # pads return but stay low


def arp_fade(t: float) -> float:
    """Arpeggio volume multiplier: 0 in A, ramps up across B, full in C."""
    if t < SEC_A_END:
        return 0.0
    elif t < SEC_B_END:
        return (t - SEC_A_END) / (SEC_B_END - SEC_A_END)   # 0 → 1
    else:
        return 1.0


def make_track() -> np.ndarray:
    total = int(SR * GEN_SEC)
    track = np.zeros(total)

    chord_idx = 0
    t = 0.0

    while t < GEN_SEC:
        name = PROGRESSION[chord_idx % len(PROGRESSION)]
        ch   = CHORDS[name]

        beat, chord_beats = section_params(t)
        chord_dur = min(beat * chord_beats, GEN_SEC - t)
        if chord_dur < 0.05:
            break
        cn = int(SR * chord_dur)

        # Fade factors for this chord (use midpoint time for smooth crossfades)
        t_mid = t + chord_dur / 2
        pf = pad_fade(t_mid)
        af = arp_fade(t_mid)

        # ── PADS ──
        PAD_BASE = 0.28
        if pf > 0:
            for note in ch['pad']:
                seg = pad_tone(freq(note), cn, atk=0.5, rel=1.0) * PAD_BASE * pf
                write(track, t, seg)

        # ── BASS ── (follows pad presence but stays slightly longer into B)
        bass_pf = min(pf * 1.4, 1.0)
        if bass_pf > 0.05:
            bseg = bass_tone(freq(ch['bass']), cn) * 0.14 * bass_pf
            write(track, t, bseg)

        # ── QUARTER ARPEGGIO (section B transition) ──
        if SEC_A_END <= t < SEC_B_END and af > 0:
            arp_notes = ch['arp']
            step = beat           # one note per beat
            arp_vol = 0.22 * af   # ramps from 0 → 0.22
            for step_i in range(int(chord_dur / step)):
                note_t = t + step_i * step
                if note_t >= GEN_SEC:
                    break
                n2 = arp_notes[step_i % len(arp_notes)]
                nn = min(int(SR * step * 0.82), int(SR * 0.5))
                seg = bright_tone(freq(n2), nn, atk=0.01, rel=0.22) * arp_vol
                write(track, note_t, seg)

        # ── 8TH ARPEGGIO + HIGH MELODY (section C) ──
        if t >= SEC_B_END:
            arp_notes = ch['arp']
            step = beat / 2       # 8th notes at BPM_C
            arp_vol = 0.24        # full presence
            for step_i in range(int(chord_dur / step)):
                note_t = t + step_i * step
                if note_t >= GEN_SEC:
                    break
                n2 = arp_notes[step_i % len(arp_notes)]
                nn = min(int(SR * step * 0.75), int(SR * 0.28))
                seg = bright_tone(freq(n2), nn, atk=0.008, rel=0.16) * arp_vol
                write(track, note_t, seg)

            # High melody on beats 1 and 3
            melody_map = {'C': ['C5','G5'], 'Am': ['A5','E5'],
                          'F': ['F5','C6'], 'G':  ['G5','D6']}
            for mi, mn in enumerate(melody_map.get(name, [ch['arp'][-1]])):
                note_t = t + mi * beat * 2
                if note_t >= GEN_SEC:
                    break
                nn = min(int(SR * beat * 1.5), int(SR * 0.9))
                # gradually louder as section C progresses
                c_progress = min((t - SEC_B_END) / 25.0, 1.0)
                seg = bright_tone(freq(mn), nn, atk=0.02, rel=0.5) * (0.10 + 0.08 * c_progress)
                write(track, note_t, seg)

        t += chord_dur
        chord_idx += 1

    # ── REVERB ──
    print("  applying reverb...")
    track = reverb(track, wet=0.32)

    # ── OVERALL VOLUME ARC (vectorised) ──
    ts = np.arange(total) / SR
    gain = np.ones(total)
    # B: ramp from 1.0 → 1.3
    mask_b = (ts >= SEC_A_END) & (ts < SEC_B_END)
    gain[mask_b] = 1.0 + 0.30 * ((ts[mask_b] - SEC_A_END) / (SEC_B_END - SEC_A_END))
    # C: continue from 1.3 → 1.5 over first 30s, then hold
    mask_c = ts >= SEC_B_END
    gain[mask_c] = 1.30 + 0.20 * np.minimum((ts[mask_c] - SEC_B_END) / 30.0, 1.0)
    track *= gain

    # ── NORMALIZE ──
    peak = np.max(np.abs(track))
    if peak > 0:
        track = track / peak * 0.88

    # ── GLOBAL FADES ──
    fi = int(SR * 4.0)
    fo = int(SR * 5.0)
    track[:fi]  *= np.linspace(0, 1, fi)
    track[-fo:] *= np.linspace(1, 0, fo)

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
    print(f"  Arc: pads-only 0–{SEC_A_END}s  |  transition {SEC_A_END}–{SEC_B_END}s (BPM {BPM_B})  |  uplifting {SEC_B_END}–85s (BPM {BPM_C})")

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
