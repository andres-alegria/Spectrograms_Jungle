#!/usr/bin/env python3
"""
compute_spectrogram.py
──────────────────────
Re-generates the pre-computed spectrogram data embedded in script.js.
Run this whenever you swap audio files.

Usage:
  python3 tools/compute_spectrogram.py

Requirements:
  pip install numpy scipy

Output:
  Prints updated SPEC = {...} JavaScript to stdout.
  Paste it into script.js to replace the existing SPEC constant.
"""

import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram as sp_spectrogram

# ── TWEAK: paths to your WAV files and their keys ─────────────────────
TRACKS = {
    'chainsaw': 'assets/audio/chainsaw.wav',
    'gunshot':  'assets/audio/gunshot.wav',
    'jaguar':   'assets/audio/jaguar.wav',
}

# TWEAK: maximum frequency to include (Hz) — higher = more high-freq detail
FREQ_MAX = 10000

# TWEAK: output grid resolution (time columns × frequency rows)
# More columns/rows = sharper but larger file
T_OUT = 400
F_OUT = 100

results = {}
for name, path in TRACKS.items():
    rate, data = wavfile.read(path)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float32)
    data /= np.max(np.abs(data)) + 1e-9

    f, t, Sxx = sp_spectrogram(data, fs=rate, nperseg=512, noverlap=448, scaling='spectrum')
    Sxx_db = 10 * np.log10(Sxx + 1e-10)
    vmin = np.percentile(Sxx_db, 5)
    vmax = np.percentile(Sxx_db, 99)
    Sxx_norm = np.clip((Sxx_db - vmin) / (vmax - vmin), 0, 1)

    freq_mask = f <= FREQ_MAX
    Sxx_crop = Sxx_norm[freq_mask, :]
    n_freq, n_time = Sxx_crop.shape
    duration = len(data) / rate

    t_idx = np.linspace(0, n_time - 1, T_OUT).astype(int)
    f_idx = np.linspace(0, n_freq - 1, F_OUT).astype(int)
    grid = np.flipud(Sxx_crop[np.ix_(f_idx, t_idx)])
    flat = (grid * 255).astype(np.uint8).flatten().tolist()

    results[name] = {'duration': round(duration, 3), 'freqBins': F_OUT, 'timeCols': T_OUT, 'data': flat}
    print(f"  {name}: {duration:.2f}s → {F_OUT}×{T_OUT} grid", flush=True)

print("\nPaste the following into script.js as the SPEC constant:\n")
print("const SPEC =", json.dumps(results, separators=(',', ':')), ";")
