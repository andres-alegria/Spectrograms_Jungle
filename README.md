# Sounds of the Jungle

An interactive audio visualizer for three field recordings.

## Project structure

```
sounds-of-the-jungle/
├── index.html               ← Page structure + annotated comments
├── style.css                ← All visual styling + annotated comments
├── script.js                ← Audio playback + visualizer + annotated comments
└── assets/
    ├── audio/
    │   ├── chainsaw.wav
    │   ├── gunshot.wav
    │   └── jaguar.wav
    └── images/
        ├── chainsaw.svg     ← Spectrogram icons (button cover)
        ├── gunshot.svg
        └── jaguar.svg
```

## How to run

Open `index.html` in any modern browser. No build step or server required — but note that some browsers block local audio file loading from `file://`. If audio doesn't play, serve the folder with a simple local server:

```bash
# Python 3
python3 -m http.server 8080
# then open http://localhost:8080
```

## Quick-reference: where to tweak things

| What you want to change | File | Where |
|---|---|---|
| Page title (browser tab) | index.html | `<title>` tag |
| Title text | index.html | `.title` div |
| Subtitle text | index.html | `.subtitle` div |
| Title font / size / color | style.css | `.title` block |
| Subtitle font / size / color | style.css | `.subtitle` block |
| Page background color | style.css | `body { background: … }` |
| Button label text | index.html | `.btn-name` span per button |
| Button images | assets/images/ + index.html | Replace image files + update `src` |
| Button border / hover colors | style.css | `.sound-btn`, `.sound-btn:hover`, `.sound-btn.active` |
| Audio files | assets/audio/ + script.js | Replace wav files + update `src` and `duration` in AUDIO object |
| Visualizer bar colors | script.js | `barColor()` function |
| Visualizer bar height | script.js | `redrawTimeline()` → `ratio * canvasH * 0.9` |
| Visualizer bar width/gap | script.js | `BAR_W` / `GAP` constants |
| Visualizer canvas height | style.css + script.js | `#timeline-canvas { height }` and `canvasH = 110` |
| Canvas background color | script.js | `ctx.fillStyle = '#f0eeea'` in `redrawTimeline()` |
| Sources / credits text | index.html | `.sources` div |
| Sources text color / size | style.css | `.sources` block |
| Small-screen breakpoint | style.css | `@media (max-width: 900px)` |
