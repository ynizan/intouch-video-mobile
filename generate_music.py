#!/usr/bin/env python3
"""
Generate background music for the InTouch animatic.

Arc: slow ambient intro → builds midway → uplifting energetic finish.

  0 – 38s   Ambient pads only (long, soft chords)
  38 – 55s  Pads + gentle quarter-note arpeggio (building momentum)
  55 – 85s  Pads + bright 8th-note arpeggio + high melody (uplifting payoff)

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
GEN_SEC     = TARGET_SEC + 3      # generate a bit long, trim at export
BPM         = 90                   # underlying tempo (supports arpeggios)
BEAT        = 60.0 / BPM          # ~0.667s
CHORD_BEATS = 8                    # 8 beats per chord = ~5.3s (slow feel in section A)

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
    env[:a] = np.linspace(0, 1, a)
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

SEC_A_END   = 38.0   # pads only
SEC_B_END   = 55.0   # pads + quarter arpeggio
# SEC_C = 55 → 85s    pads + 8th arpeggio + high melody

# ── TRACK BUILDER ────────────────────────────────────────────────────────────

def make_track() -> np.ndarray:
    total = int(SR * GEN_SEC)
    track = np.zeros(total)

    chord_idx = 0
    t = 0.0   # current time in seconds

    while t < GEN_SEC:
        name = PROGRESSION[chord_idx % len(PROGRESSION)]
        ch   = CHORDS[name]

        # chord duration depends on section
        if t < SEC_A_END:
            chord_dur = BEAT * CHORD_BEATS        # ~5.3s — slow
        elif t < SEC_B_END:
            chord_dur = BEAT * 4                  # ~2.7s — half-bar
        else:
            chord_dur = BEAT * 4                  # ~2.7s same, but layer is busier

        chord_dur = min(chord_dur, GEN_SEC - t)
        if chord_dur < 0.05:
            break
        cn = int(SR * chord_dur)

        # ── PADS ──
        pad_vol = 0.28 if t < SEC_B_END else 0.22  # pads sit back when arps enter
        for note in ch['pad']:
            seg = pad_tone(freq(note), cn, atk=0.5, rel=1.0) * pad_vol
            write(track, t, seg)

        # ── BASS ──
        bass_vol = 0.14
        bseg = bass_tone(freq(ch['bass']), cn) * bass_vol
        write(track, t, bseg)

        # ── QUARTER ARPEGGIO  (section B only) ──
        if SEC_A_END <= t < SEC_B_END:
            arp_notes = ch['arp']
            step = BEAT  # one note per beat
            for step_i in range(int(chord_dur / step)):
                note_t = t + step_i * step
                if note_t >= GEN_SEC:
                    break
                n2 = arp_notes[step_i % len(arp_notes)]
                nn = min(int(SR * step * 0.85), int(SR * 0.5))
                seg = bright_tone(freq(n2), nn, atk=0.01, rel=0.22) * 0.18
                write(track, note_t, seg)

        # ── 8TH ARPEGGIO + MELODY  (section C) ──
        if t >= SEC_B_END:
            arp_notes = ch['arp']
            step = BEAT / 2  # 8th notes
            for step_i in range(int(chord_dur / step)):
                note_t = t + step_i * step
                if note_t >= GEN_SEC:
                    break
                n2 = arp_notes[step_i % len(arp_notes)]
                nn = min(int(SR * step * 0.75), int(SR * 0.3))
                vol = 0.22
                seg = bright_tone(freq(n2), nn, atk=0.008, rel=0.18) * vol
                write(track, note_t, seg)

            # High melody — root + fifth in upper octave, on beats 1 and 3
            melody_map = {'C': ['C5','G5'], 'Am': ['A5','E5'],
                          'F': ['F5','C6'], 'G': ['G5','D6']}
            m_notes = melody_map.get(name, [ch['arp'][-1]])
            for mi, mn in enumerate(m_notes):
                note_t = t + mi * BEAT * 2
                if note_t >= GEN_SEC:
                    break
                nn = min(int(SR * BEAT * 1.5), int(SR * 1.0))
                seg = bright_tone(freq(mn), nn, atk=0.02, rel=0.5) * 0.13
                write(track, note_t, seg)

        t += chord_dur
        chord_idx += 1

    # ── REVERB ──
    print("  applying reverb...")
    track = reverb(track, wet=0.32)

    # ── SECTION CROSSFADE (gradual volume ramp in sections B & C) ──
    # Gently increase overall presence from section B onward
    for i in range(total):
        ts = i / SR
        if ts < SEC_A_END:
            gain = 1.0
        elif ts < SEC_B_END:
            gain = 1.0 + 0.25 * ((ts - SEC_A_END) / (SEC_B_END - SEC_A_END))
        else:
            gain = 1.25 + 0.15 * min((ts - SEC_B_END) / 20.0, 1.0)
        track[i] *= gain

    # ── NORMALIZE ──
    peak = np.max(np.abs(track))
    if peak > 0:
        track = track / peak * 0.88

    # ── GLOBAL FADES ──
    fi = int(SR * 4.0)   # 4s fade-in
    fo = int(SR * 5.0)   # 5s fade-out
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
    print(f"  BPM {BPM}  |  Arc: ambient → builds ~{SEC_A_END}s → uplifting ~{SEC_B_END}s")

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
