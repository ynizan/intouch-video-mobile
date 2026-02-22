#!/usr/bin/env python3
"""
Build script: assembles dist/index.html from source parts.

Source layout:
  index.html        -- shell: controls HTML + SCENES data (has <!-- SCENES_INJECT --> placeholder)
  styles/base.css   -- shared CSS (reset, player, type A/B/C, controls)
  styles/scenes.css -- per-scene CSS
  scenes/s01-*.html .. s11-*.html -- scene HTML fragments
  player.js         -- playback engine (expects SCENES/TOTAL/START_TIMES defined)
  audio/*.mp3       -- audio assets (copied to dist/)

Output:
  dist/index.html   -- single self-contained file (CSS + scenes + JS all inlined)
  dist/*.mp3        -- audio assets
"""
import os
import re
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()

# Ensure output dir
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)

# Copy audio files
audio_dir = os.path.join(ROOT, 'audio')
dist_dir  = os.path.join(ROOT, 'dist')
for fname in os.listdir(audio_dir):
    if fname.endswith('.mp3'):
        shutil.copy(os.path.join(audio_dir, fname), os.path.join(dist_dir, fname))

# Read CSS
base_css   = read('styles/base.css')
scenes_css = read('styles/scenes.css')
all_css    = base_css + '\n' + scenes_css

# Read scene fragments in order
scene_order = [
    'scenes/s01-opening.html',
    'scenes/s02-calendar.html',
    'scenes/s03-linkedin.html',
    'scenes/s04-email.html',
    'scenes/s05-pivot.html',
    'scenes/s06-scan.html',
    'scenes/s07-brief.html',
    'scenes/s08-momentum.html',
    'scenes/s09-compounded.html',
    'scenes/s10-counter.html',
    'scenes/s11-endcard.html',
]
scenes_html = '\n'.join(read(f) for f in scene_order)

# Read JS engine
player_js = read('player.js')

# Read shell template
shell = read('index.html')

# 1. Inline CSS: replace the two <link> stylesheet tags with a single <style> block
shell = re.sub(
    r'<link rel="stylesheet" href="styles/base\.css">\s*\n\s*<link rel="stylesheet" href="styles/scenes\.css">',
    '<style>\n' + all_css + '\n</style>',
    shell
)

# 2. Inject scene fragments
shell = shell.replace('<!-- SCENES_INJECT -->', scenes_html)

# 3. Inline player.js: replace <script src="player.js"></script>
shell = shell.replace(
    '<script src="player.js"></script>',
    '<script>\n' + player_js + '\n</script>'
)

# Write output
out_path = os.path.join(dist_dir, 'index.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(shell)

print(f'Built: {out_path}')
print(f'  CSS: {len(all_css):,} chars')
print(f'  Scenes: {len(scenes_html):,} chars')
print(f'  JS: {len(player_js):,} chars')
print(f'  Total: {len(shell):,} chars')
