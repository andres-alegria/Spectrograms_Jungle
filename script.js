/* =============================================================
   SOUNDS OF THE JUNGLE — script.js
   -------------------------------------------------------------
   All audio playback and timeline visualizer logic lives here.
   Annotated comments mark every place you might want to tweak.
   ============================================================= */


/* ── AUDIO TRACK REGISTRY ─────────────────────────────────────
   Add, remove, or rename tracks here.
   Each key must match the data-audio="..." attribute on the
   corresponding button in index.html.

   TWEAK: Change file paths if you rename or move audio files.
   TWEAK: Update `duration` (in seconds) if you swap audio files.
         Run: ffprobe -i yourfile.wav  to get the duration.      */
const AUDIO = {
  chainsaw: { src: 'assets/audio/chainsaw.wav', duration: 18.63 },
  gunshot:  { src: 'assets/audio/gunshot.wav',  duration: 2.47  },
  jaguar:   { src: 'assets/audio/jaguar.wav',   duration: 11.19 }
};


/* ── SPECTROGRAM COLOR SCALE ──────────────────────────────────
   Maps an amplitude ratio (0 = silence → 1 = loudest) to a
   color that matches the spectrogram palette in the PNG images.

   TWEAK: Change the hex values to restyle the visualizer bars.
   TWEAK: Adjust the ratio thresholds (0.08, 0.20 …) to shift
          where each color appears along the amplitude range.

   Current scale: black → deep purple → magenta → red →
                  orange → yellow → pale yellow              */
function barColor(ratio) {
  if (ratio < 0.08) return '#000000';   /* near silence       */
  if (ratio < 0.20) return '#1a0030';   /* very quiet: indigo */
  if (ratio < 0.32) return '#4b0060';   /* quiet: dark purple */
  if (ratio < 0.44) return '#8b0060';   /* low-mid: magenta   */
  if (ratio < 0.55) return '#c0003c';   /* mid: crimson red   */
  if (ratio < 0.65) return '#e84800';   /* mid-high: orange   */
  if (ratio < 0.75) return '#ff8c00';   /* high: amber        */
  if (ratio < 0.85) return '#ffd000';   /* very high: yellow  */
  return '#ffffc0';                      /* peak: pale yellow  */
}


/* ── CANVAS SETUP ─────────────────────────────────────────────
   The timeline canvas resizes automatically with the window.  */
const canvas = document.getElementById('timeline-canvas');
const ctx    = canvas.getContext('2d');
let canvasW  = 0;
let canvasH  = 0;

/* Called on load and whenever the window resizes */
function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvasW    = wrap.clientWidth;

  /* TWEAK: Canvas height in pixels — keep in sync with
     the #timeline-canvas height in style.css            */
  canvasH    = 110;

  canvas.width  = canvasW;
  canvas.height = canvasH;
  redrawTimeline();
}
window.addEventListener('resize', resizeCanvas);


/* ── TIMELINE STATE ───────────────────────────────────────────
   timelineData stores the peak amplitude recorded at each
   horizontal pixel column during playback. This is what gets
   drawn as accumulating bars on the canvas.                   */
let timelineData = new Float32Array(2000); /* max columns      */
let currentKey      = null;   /* which track is loaded         */
let currentDuration = 0;      /* track duration in seconds     */
let currentHead     = 0;      /* playhead x-position in pixels */

function clearTimeline() {
  timelineData.fill(0);
  currentHead = 0;
  redrawTimeline();
}


/* ── DRAW TIMELINE ────────────────────────────────────────────
   Repaints the entire canvas: background → bars → playhead.  */
function redrawTimeline() {
  ctx.clearRect(0, 0, canvasW, canvasH);

  /* TWEAK: Canvas background color (behind the bars) */
  ctx.fillStyle = '#f0eeea';
  ctx.fillRect(0, 0, canvasW, canvasH);

  /* TWEAK: Bar width in pixels */
  const BAR_W = 3;

  /* TWEAK: Gap between bars in pixels */
  const GAP   = 1;

  const STEP  = BAR_W + GAP;

  /* Draw each column that has recorded amplitude data */
  for (let col = 0; col * STEP < canvasW; col++) {
    const ratio = timelineData[col] || 0;

    /* TWEAK: Minimum ratio before a bar is drawn (filters
       near-silence columns so the canvas looks cleaner)  */
    if (ratio < 0.02) continue;

    /* TWEAK: Bar height scale — 0.9 = bars reach 90% of
       canvas height at maximum amplitude                 */
    const h = Math.max(2, ratio * canvasH * 0.9);
    const y = (canvasH - h) / 2; /* center bars vertically */

    ctx.fillStyle = barColor(ratio);
    ctx.fillRect(col * STEP, y, BAR_W, h);
  }

  /* Playhead — vertical line showing current read position */
  if (currentHead > 0 && currentKey) {
    /* TWEAK: Playhead color and opacity */
    ctx.strokeStyle = 'rgba(0, 48, 41, 0.5)';

    /* TWEAK: Playhead line thickness */
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(currentHead, 4);
    ctx.lineTo(currentHead, canvasH - 4);
    ctx.stroke();
  }
}


/* ── WEB AUDIO STATE ──────────────────────────────────────────
   audioCtx  — single shared AudioContext (browsers allow one)
   analyser  — reads frequency data frame-by-frame
   currentAudio — the <Audio> element currently loaded        */
let audioCtx    = null;
let analyser    = null;
let currentAudio = null;
let animId      = null;
let currentBtn  = null;


/* ── SELECT SOUND (button click handler) ──────────────────────
   Called when the user clicks any of the three buttons.
   If the clicked button is already playing, it stops.        */
function selectSound(btn) {
  const key = btn.dataset.audio;

  /* Toggle off if already playing */
  if (currentBtn === btn && currentAudio && !currentAudio.paused) {
    stopAll();
    return;
  }

  stopAll();
  currentBtn      = btn;
  btn.classList.add('active');
  clearTimeline();
  currentKey      = key;
  currentDuration = AUDIO[key].duration;
  playAudio(key);
}


/* ── STOP ALL PLAYBACK ────────────────────────────────────────
   Halts audio, cancels animation, resets UI state.           */
function stopAll() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (animId) cancelAnimationFrame(animId);
  if (currentBtn) currentBtn.classList.remove('active');
  currentBtn  = null;
  currentKey  = null;
  currentHead = 0;
}


/* ── PLAY AUDIO ───────────────────────────────────────────────
   Creates a Web Audio pipeline:
   <Audio element> → AnalyserNode → AudioContext destination  */
function playAudio(key) {
  /* Create shared AudioContext lazily (browsers require a
     user gesture before allowing audio context creation)      */
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const audio = new Audio(AUDIO[key].src);
  audio.crossOrigin = 'anonymous';
  currentAudio = audio;

  const src = audioCtx.createMediaElementSource(audio);
  analyser   = audioCtx.createAnalyser();

  /* TWEAK: FFT size — larger = more frequency detail but
     slower. Must be a power of 2 (128, 256, 512, 1024…)      */
  analyser.fftSize = 512;

  src.connect(analyser);
  analyser.connect(audioCtx.destination);

  audio.play();

  /* Reset button state when track finishes naturally */
  audio.onended = () => {
    if (currentBtn) currentBtn.classList.remove('active');
    currentBtn  = null;
    currentKey  = null;
    currentHead = 0;
    cancelAnimationFrame(animId);
    redrawTimeline();
  };

  animate();
}


/* ── ANIMATION LOOP ───────────────────────────────────────────
   Runs every frame while audio is playing. It:
   1. Maps current playback time → canvas column
   2. Samples the analyser for amplitude
   3. Stores the peak in timelineData
   4. Redraws the canvas                                       */
function animate() {
  animId = requestAnimationFrame(animate);
  if (!analyser || !currentAudio) return;

  /* TWEAK: Bar width and gap — keep in sync with redrawTimeline */
  const BAR_W = 3;
  const GAP   = 1;
  const STEP  = BAR_W + GAP;
  const totalCols = Math.floor(canvasW / STEP);

  /* Map playback time to a canvas column */
  const elapsed = currentAudio.currentTime;           /* seconds */
  const col     = Math.floor((elapsed / currentDuration) * totalCols);
  currentHead   = col * STEP + BAR_W / 2;            /* pixel x */

  /* Read frequency data from the analyser */
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  /* Compute RMS amplitude from a mid-frequency band.
     TWEAK: Change lo/hi fractions to emphasise different
     frequency ranges:
       0.0–0.1  = sub-bass
       0.05–0.3 = bass + low-mids  (current lower bound)
       0.3–0.6  = mids             (current upper bound)
       0.6–1.0  = highs             */
  let sum = 0;
  const lo = Math.floor(data.length * 0.05);
  const hi = Math.floor(data.length * 0.60);
  for (let i = lo; i < hi; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / (hi - lo)) / 255;

  /* Record the highest amplitude seen at this column
     (peak-hold so bars never shrink once drawn)               */
  if (col >= 0 && col < totalCols) {
    timelineData[col] = Math.max(timelineData[col], rms);
  }

  redrawTimeline();
}


/* ── INIT ─────────────────────────────────────────────────────
   Size the canvas correctly on first load.                   */
resizeCanvas();
