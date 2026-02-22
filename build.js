#!/usr/bin/env node
/**
 * Build script: assembles dist/index.html from source parts.
 *
 * Source layout:
 *   index.html        -- shell with <!-- SCENES_INJECT --> placeholder
 *   styles/base.css   -- shared CSS
 *   styles/scenes.css -- per-scene CSS
 *   scenes/s01-*.html .. s11-*.html -- scene HTML fragments
 *   player.js         -- playback engine
 *   audio/*.mp3       -- audio assets (copied to dist/)
 *
 * Output:
 *   dist/index.html   -- single self-contained file (CSS + scenes + JS inlined)
 *   dist/*.mp3        -- audio assets
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const distDir = path.join(ROOT, 'dist');

// Ensure output dir
fs.mkdirSync(distDir, { recursive: true });

// Copy audio files
const audioDir = path.join(ROOT, 'audio');
for (const fname of fs.readdirSync(audioDir)) {
  if (fname.endsWith('.mp3')) {
    fs.copyFileSync(path.join(audioDir, fname), path.join(distDir, fname));
  }
}

// Read CSS
const baseCss = fs.readFileSync(path.join(ROOT, 'styles/base.css'), 'utf-8');
const scenesCss = fs.readFileSync(path.join(ROOT, 'styles/scenes.css'), 'utf-8');
const allCss = baseCss + '\n' + scenesCss;

// Read scene fragments in order
const sceneOrder = [
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
];
const scenesHtml = sceneOrder
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf-8'))
  .join('\n');

// Read JS engine
const playerJs = fs.readFileSync(path.join(ROOT, 'player.js'), 'utf-8');

// Read shell template
let shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');

// 1. Inline CSS: replace the two <link> stylesheet tags with a single <style> block
shell = shell.replace(
  /<link rel="stylesheet" href="styles\/base\.css">\s*\n\s*<link rel="stylesheet" href="styles\/scenes\.css">/,
  '<style>\n' + allCss + '\n</style>'
);

// 2. Inject scene fragments
shell = shell.replace('<!-- SCENES_INJECT -->', scenesHtml);

// 3. Inline player.js: replace <script src="player.js"></script>
shell = shell.replace(
  '<script src="player.js"></script>',
  '<script>\n' + playerJs + '\n</script>'
);

// Write output
const outPath = path.join(distDir, 'index.html');
fs.writeFileSync(outPath, shell, 'utf-8');

console.log(`Built: ${outPath}`);
console.log(`  CSS: ${allCss.length.toLocaleString()} chars`);
console.log(`  Scenes: ${scenesHtml.length.toLocaleString()} chars`);
console.log(`  JS: ${playerJs.length.toLocaleString()} chars`);
console.log(`  Total: ${shell.length.toLocaleString()} chars`);
