import * as THREE from "three";

const BACKGROUND_IMAGE_URL = "background.png";
const PLANE_WIDTH = 256;
const PLANE_HEIGHT = 256;
const SLIDE_SPACING_X = 80;

let numSlides = 0;
let currentSlideIndex = 0;

/** @type {SlideCard[]} */
const slides = [];
/** @type {object[]} */
let albumData = [];

// ── Three.js setup ──────────────────────────────────────────────────────────

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ── Coverflow navigation slider ─────────────────────────────────────────────

const elementInput = document.querySelector("input#rangeSlider");
elementInput.addEventListener("input", () => { if (!isFlipOpen()) onSliderChange(); });

window.addEventListener("wheel", (event) => {
  if (isFlipOpen()) return;
  elementInput.valueAsNumber += event.deltaY * 0.0005;
  onSliderChange();
  event.preventDefault();
}, { passive: false });

// ── Drag / swipe ────────────────────────────────────────────────────────────

let isDragging = false;
let hasMoved = false;
let startX = 0;
let currentScrollLeft = 0;

renderer.domElement.addEventListener('mousedown', onPointerDown);
renderer.domElement.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
renderer.domElement.addEventListener('touchend', onPointerUp);
renderer.domElement.addEventListener('touchcancel', onPointerUp);

function isFlipOpen() {
  return flipOverlay.classList.contains('visible');
}

function onPointerDown(event) {
  if (isFlipOpen()) return;
  isDragging = true;
  hasMoved = false;
  startX = event.clientX ?? event.touches[0].clientX;
  currentScrollLeft = elementInput.valueAsNumber;
  renderer.domElement.style.cursor = 'grabbing';
  event.preventDefault?.();
}

function onPointerMove(event) {
  if (!isDragging || isFlipOpen()) return;
  event.preventDefault();
  const currentX = event.clientX ?? event.touches[0].clientX;
  const deltaX = currentX - startX;
  if (Math.abs(deltaX) > 5) hasMoved = true;
  const sensitivity = window.innerWidth * 2;
  elementInput.valueAsNumber = Math.max(0, Math.min(1, currentScrollLeft - deltaX / sensitivity));
  onSliderChange();
}

function onPointerUp() {
  if (!isDragging) return;
  isDragging = false;
  if (isFlipOpen()) return;
  renderer.domElement.style.cursor = 'grab';
  if (!hasMoved) showFlipCard();
}

renderer.domElement.style.cursor = 'grab';

// ── Media player ─────────────────────────────────────────────────────────────

const audioEl       = document.getElementById('audio-el');
const playPauseBtn  = document.getElementById('play-pause-btn');
const progressBar   = document.getElementById('progress-bar');
const timeCurrent   = document.getElementById('time-current');
const timeTotal     = document.getElementById('time-total');
const playerTitle   = document.getElementById('player-title');

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

playPauseBtn.addEventListener('click', () => {
  audioEl.paused ? audioEl.play() : audioEl.pause();
});

audioEl.addEventListener('play',  () => { playPauseBtn.textContent = '⏸'; });
audioEl.addEventListener('pause', () => { playPauseBtn.textContent = '▶'; });
audioEl.addEventListener('ended', () => { playPauseBtn.textContent = '▶'; });

audioEl.addEventListener('timeupdate', () => {
  if (!audioEl.duration) return;
  progressBar.value = (audioEl.currentTime / audioEl.duration) * 100;
  timeCurrent.textContent = formatTime(audioEl.currentTime);
});

audioEl.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audioEl.duration);
});

progressBar.addEventListener('input', () => {
  if (audioEl.duration) audioEl.currentTime = (progressBar.value / 100) * audioEl.duration;
});

function updatePlayer(album) {
  playerTitle.textContent = album.artists
    ? `${album.artists} — ${album.title}`
    : album.title;

  const hasAudio = !!album.audio_url;
  playPauseBtn.disabled = !hasAudio;
  progressBar.disabled  = !hasAudio;

  if (hasAudio) {
    const wasPlaying = !audioEl.paused;
    audioEl.src = album.audio_url;
    if (wasPlaying) audioEl.play();
  } else {
    audioEl.src = '';
    timeCurrent.textContent = '0:00';
    timeTotal.textContent   = '0:00';
    progressBar.value = 0;
  }
}

// ── Flip card ────────────────────────────────────────────────────────────────

const flipOverlay     = document.getElementById('flip-overlay');
const flipScene       = document.getElementById('flip-scene');
const flipCardInner   = document.getElementById('flip-card-inner');
const flipCoverImg    = document.getElementById('flip-cover-img');
const flipTextContent = document.getElementById('flip-text-content');
const flipClose       = document.getElementById('flip-close');

flipClose.addEventListener('click', closeFlipCard);

/** Match the flip card size to the visual size of the center Three.js card. */
function syncFlipCardSize() {
  // Vertical FOV is 30°; camera is at z=900; card is PLANE_HEIGHT units tall
  const halfFovRad = (30 / 2) * (Math.PI / 180);
  const worldHeight = 2 * camera.position.z * Math.tan(halfFovRad);
  const px = Math.round(PLANE_HEIGHT / worldHeight * window.innerHeight);
  flipScene.style.width  = px + 'px';
  flipScene.style.height = px + 'px';
}

/** Currently-active timeupdate listener driving cue highlighting, if any. */
let cueHighlightHandler = null;

function clearCueHighlight() {
  if (cueHighlightHandler) {
    audioEl.removeEventListener('timeupdate', cueHighlightHandler);
    cueHighlightHandler = null;
  }
}

/** Parse an SRT subtitle file into [{ start, end, text }, ...] (seconds). */
function parseSRT(srtText) {
  const toSeconds = (t) => {
    const [, h, m, s, ms] = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/.exec(t);
    return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
  };

  return srtText
    .replace(/\r/g, '')
    .split(/\n\n+/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const lines = block.split('\n');
      let i = 0;
      if (/^\d+$/.test(lines[i])) i++; // skip numeric subtitle index
      const timing = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/.exec(lines[i]);
      if (!timing) return null;
      return {
        start: toSeconds(timing[1]),
        end: toSeconds(timing[2]),
        text: lines.slice(i + 1).join(' ').trim(),
      };
    })
    .filter(Boolean);
}

/** Render timed cues as paragraphs and highlight the one matching audio playback time. */
function renderCues(cues) {
  flipTextContent.innerHTML = '';
  const paragraphs = cues.map(cue => {
    const p = document.createElement('p');
    p.className = 'cue';
    p.textContent = cue.text;
    flipTextContent.appendChild(p);
    return p;
  });

  cueHighlightHandler = () => {
    const t = audioEl.currentTime;
    let active = null;
    for (let i = 0; i < cues.length; i++) {
      const isActive = t >= cues[i].start && t < cues[i].end;
      paragraphs[i].classList.toggle('active', isActive);
      if (isActive) active = paragraphs[i];
    }
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  audioEl.addEventListener('timeupdate', cueHighlightHandler);
}

async function showFlipCard() {
  const album = albumData[currentSlideIndex];

  syncFlipCardSize();
  clearCueHighlight();

  // Hide the center Three.js card so it doesn't show through the semi-transparent overlay
  slides[currentSlideIndex].visible = false;

  // Show overlay with cover on front
  flipCoverImg.src = album.image_url;
  flipCoverImg.alt = album.title;
  flipTextContent.textContent = '加载中…';
  flipCardInner.classList.remove('flipped');
  flipOverlay.classList.add('visible');

  // Small delay so the browser renders the initial state before flipping
  await new Promise(r => setTimeout(r, 40));
  flipCardInner.classList.add('flipped');

  // Prefer timed cues (synced highlighting): .srt or .json. Fall back to plain text, then a placeholder.
  if (album.cues_url) {
    try {
      const res = await fetch(album.cues_url);
      if (res.ok) {
        const isSRT = album.cues_url.toLowerCase().endsWith('.srt');
        const cues = isSRT ? parseSRT(await res.text()) : await res.json();
        renderCues(cues);
      } else {
        flipTextContent.textContent = '（文件读取失败）';
      }
    } catch {
      flipTextContent.textContent = '（文件读取失败）';
    }
  } else if (album.text_url) {
    try {
      const res = await fetch(album.text_url);
      flipTextContent.textContent = res.ok ? await res.text() : '（文件读取失败）';
    } catch {
      flipTextContent.textContent = '（文件读取失败）';
    }
  } else {
    flipTextContent.textContent = '（暂无文本内容）';
  }
}

function closeFlipCard() {
  flipCardInner.classList.remove('flipped');
  setTimeout(() => {
    flipOverlay.classList.remove('visible');
    slides[currentSlideIndex].visible = true;
    clearCueHighlight();
  }, 650);
}

// ── Gesture control ──────────────────────────────────────────────────────────
// Optional camera-based control, toggled on demand. Uses MediaPipe Tasks Vision's
// GestureRecognizer (7 built-in static poses) for flip/close/play/pause, plus a
// hand-rolled palm-centroid tracker for swipe-left/right (not a static pose).

const GESTURE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
const GESTURE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/** Maps MediaPipe's built-in gesture categories to the labels shown in the preview panel. */
const GESTURE_ACTION_LABELS = {
  Victory: '翻转',
  Closed_Fist: '关闭',
  Thumb_Up: '播放',
  Thumb_Down: '暂停',
};

const GESTURE_SCORE_THRESHOLD = 0.65;
const GESTURE_CONFIRM_FRAMES = 3;   // consecutive frames required before firing (debounce)
const GESTURE_INFERENCE_INTERVAL_MS = 80; // throttle inference to ~12fps

const SWIPE_SMOOTHING_SAMPLES = 5;  // moving-average window, filters single-frame jitter
const SWIPE_MIN_DISPLACEMENT = 0.15; // normalized x distance (vs. reference) to trigger
const SWIPE_SETTLE_THRESHOLD = 0.025; // frame-to-frame movement below this counts as "calm"
const SWIPE_SETTLE_FRAMES = 4;      // consecutive calm frames required to re-arm after a trigger

const gestureToggleBtn = document.getElementById('gesture-toggle-btn');
const gesturePanel     = document.getElementById('gesture-panel');
const gestureVideo     = document.getElementById('gesture-video');
const gestureCanvas    = document.getElementById('gesture-canvas');
const gestureLabel     = document.getElementById('gesture-label');
const gestureCtx       = gestureCanvas.getContext('2d');

let gestureRecognizer = null;
let gestureStream = null;
let gestureLoopId = null;
let gestureActive = false;
let lastGestureInferenceTime = 0;
let lastGestureVideoTime = -1;

let pendingGesture = null;
let pendingGestureCount = 0;
let lastFiredGesture = null;

let swipeXHistory = [];     // recent raw x samples, smoothed via moving average
let swipeReferenceX = null; // smoothed x position the next swipe is measured from
let swipeArmed = true;      // false right after a trigger, until the hand settles
let swipeSettleCount = 0;
let prevSmoothedX = null;

gestureToggleBtn.addEventListener('click', () => {
  gestureActive ? stopGestureMode() : startGestureMode();
});

async function loadGestureRecognizer() {
  if (gestureRecognizer) return gestureRecognizer;
  const { GestureRecognizer, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'
  );
  const vision = await FilesetResolver.forVisionTasks(GESTURE_WASM_URL);
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  return gestureRecognizer;
}

async function startGestureMode() {
  gestureToggleBtn.disabled = true;
  const originalLabel = gestureToggleBtn.textContent;
  gestureToggleBtn.textContent = '⏳';

  try {
    await loadGestureRecognizer();
    gestureStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 },
      audio: false,
    });
    gestureVideo.srcObject = gestureStream;
    await gestureVideo.play();

    gestureActive = true;
    gestureToggleBtn.classList.add('active');
    gesturePanel.classList.add('visible');
    resetSwipeState();
    lastFiredGesture = null;
    pendingGesture = null;
    pendingGestureCount = 0;
    gestureLoop();
  } catch (err) {
    console.error('Failed to start gesture mode:', err);
    alert('无法开启摄像头，请检查权限设置。');
    stopGestureMode();
  } finally {
    gestureToggleBtn.disabled = false;
    gestureToggleBtn.textContent = originalLabel;
  }
}

function stopGestureMode() {
  gestureActive = false;
  gestureToggleBtn.classList.remove('active');
  gesturePanel.classList.remove('visible');
  gestureLabel.textContent = '';
  if (gestureLoopId) { cancelAnimationFrame(gestureLoopId); gestureLoopId = null; }
  if (gestureStream) { gestureStream.getTracks().forEach(t => t.stop()); gestureStream = null; }
  gestureVideo.srcObject = null;
  gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
}

function gestureLoop() {
  if (!gestureActive) return;
  gestureLoopId = requestAnimationFrame(gestureLoop);

  const now = performance.now();
  if (now - lastGestureInferenceTime < GESTURE_INFERENCE_INTERVAL_MS) return;
  lastGestureInferenceTime = now;

  if (gestureVideo.readyState < 2 || gestureVideo.currentTime === lastGestureVideoTime) return;
  lastGestureVideoTime = gestureVideo.currentTime;

  if (gestureCanvas.width !== gestureVideo.videoWidth) {
    gestureCanvas.width = gestureVideo.videoWidth;
    gestureCanvas.height = gestureVideo.videoHeight;
  }

  const result = gestureRecognizer.recognizeForVideo(gestureVideo, now);
  gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);

  if (!result.landmarks.length) {
    gestureLabel.textContent = '未检测到手';
    resetSwipeState();
    pendingGesture = null;
    pendingGestureCount = 0;
    return;
  }

  drawHandLandmarks(result.landmarks[0]);
  const swipeDebug = handleSwipeTracking(result.landmarks[0]);

  const top = result.gestures[0]?.[0];
  let gestureText;
  if (top && GESTURE_ACTION_LABELS[top.categoryName] && top.score >= GESTURE_SCORE_THRESHOLD) {
    gestureText = `${GESTURE_ACTION_LABELS[top.categoryName]} ${Math.round(top.score * 100)}%`;
    handleStaticGesture(top.categoryName);
  } else {
    gestureText = top ? top.categoryName : '未识别';
    pendingGesture = null;
    pendingGestureCount = 0;
  }

  // Debug readout: Δ is the signed displacement from the swipe reference point
  // (normalized [0,1]; triggers at ±0.15) — R = armed/ready, ⏸ = settling after a trigger.
  gestureLabel.textContent = `${gestureText} | Δ${swipeDebug.delta.toFixed(2)} ${swipeDebug.armed ? 'R' : '⏸'}`;
}

function drawHandLandmarks(landmarks) {
  gestureCtx.fillStyle = '#4ade80';
  for (const lm of landmarks) {
    gestureCtx.beginPath();
    gestureCtx.arc(lm.x * gestureCanvas.width, lm.y * gestureCanvas.height, 3, 0, Math.PI * 2);
    gestureCtx.fill();
  }
}

/** Debounced static-pose dispatch: fires once per "hold", not every frame. */
function handleStaticGesture(categoryName) {
  if (categoryName === pendingGesture) {
    pendingGestureCount++;
  } else {
    pendingGesture = categoryName;
    pendingGestureCount = 1;
  }

  if (pendingGestureCount < GESTURE_CONFIRM_FRAMES) return;
  if (categoryName === lastFiredGesture) return; // already fired for this hold
  lastFiredGesture = categoryName;

  switch (categoryName) {
    case 'Victory':
      if (!isFlipOpen()) showFlipCard();
      break;
    case 'Closed_Fist':
      if (isFlipOpen()) closeFlipCard();
      break;
    case 'Thumb_Up':
      if (!playPauseBtn.disabled && audioEl.paused) audioEl.play();
      break;
    case 'Thumb_Down':
      if (!playPauseBtn.disabled && !audioEl.paused) audioEl.pause();
      break;
  }
}

function resetSwipeState() {
  swipeXHistory = [];
  swipeReferenceX = null;
  swipeArmed = true;
  swipeSettleCount = 0;
  prevSmoothedX = null;
}

/**
 * Tracks palm centroid x-position to detect a left/right swipe motion.
 * Uses a moving average to filter single-frame jitter, and a settle-based
 * re-arm (instead of a fixed cooldown) so one swipe — fast or slow — only
 * ever fires once: after triggering, no new swipe can fire until the hand's
 * frame-to-frame movement drops below SWIPE_SETTLE_THRESHOLD for
 * SWIPE_SETTLE_FRAMES in a row.
 */
function handleSwipeTracking(landmarks) {
  if (isFlipOpen()) { resetSwipeState(); return { delta: 0, armed: true }; } // don't navigate while the card is open

  // Palm centroid: average of wrist + each finger's base knuckle.
  const idx = [0, 5, 9, 13, 17];
  const rawX = idx.reduce((sum, i) => sum + landmarks[i].x, 0) / idx.length;

  swipeXHistory.push(rawX);
  if (swipeXHistory.length > SWIPE_SMOOTHING_SAMPLES) swipeXHistory.shift();
  const smoothedX = swipeXHistory.reduce((a, b) => a + b, 0) / swipeXHistory.length;

  if (swipeReferenceX === null) swipeReferenceX = smoothedX;

  const frameMovement = prevSmoothedX === null ? 0 : Math.abs(smoothedX - prevSmoothedX);
  prevSmoothedX = smoothedX;

  // Raw video coordinates are unmirrored, but the preview is shown mirrored (CSS)
  // for a natural selfie view — invert the delta to match what the user perceives.
  const perceivedDelta = -(smoothedX - swipeReferenceX);

  if (!swipeArmed) {
    // Waiting for the hand to calm down before allowing another trigger.
    if (frameMovement < SWIPE_SETTLE_THRESHOLD) {
      swipeSettleCount++;
      if (swipeSettleCount >= SWIPE_SETTLE_FRAMES) {
        swipeArmed = true;
        swipeReferenceX = smoothedX; // re-baseline once settled
      }
    } else {
      swipeSettleCount = 0;
    }
    return { delta: perceivedDelta, armed: false };
  }

  if (Math.abs(perceivedDelta) >= SWIPE_MIN_DISPLACEMENT) {
    stepSlide(perceivedDelta > 0 ? 1 : -1);
    swipeArmed = false;
    swipeSettleCount = 0;
    return { delta: perceivedDelta, armed: false };
  }

  return { delta: perceivedDelta, armed: true };
}

function stepSlide(delta) {
  const target = Math.max(0, Math.min(numSlides - 1, currentSlideIndex + delta));
  if (target === currentSlideIndex) return;
  elementInput.valueAsNumber = target / (numSlides - 1);
  moveSlide(target);
}

// ── Scene initialization ─────────────────────────────────────────────────────

async function init() {
  const pointLight = new THREE.PointLight(0xffffff, 4, 1000);
  pointLight.position.set(0, 0, 500);
  scene.add(pointLight);

  // Prefer pre-built covers.json (Cloudflare Pages / after npm start).
  // Fall back to live /api/covers (local server without a prior build).
  try {
    let res = await fetch('./covers.json');
    if (!res.ok) res = await fetch('/api/covers');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    albumData = await res.json();
    numSlides = albumData.length;
  } catch (error) {
    console.error("Failed to load covers:", error);
    return;
  }

  for (let i = 0; i < numSlides; i++) {
    const slide = new SlideCard(albumData[i]);
    scene.add(slide);
    slides[i] = slide;
  }

  camera.position.z = 900;
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  const backgroundTexture = new THREE.TextureLoader().load(BACKGROUND_IMAGE_URL);
  const backgroundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 1000),
    new THREE.MeshBasicMaterial({ map: backgroundTexture })
  );
  backgroundMesh.position.z = -500;
  scene.add(backgroundMesh);

  const centerIndex = Math.floor(numSlides / 2);
  moveSlide(centerIndex);
  updatePlayer(albumData[centerIndex]);

  window.addEventListener("resize", onResize);
  onResize();
  tick();
}

// ── Slide movement ───────────────────────────────────────────────────────────

function onSliderChange() {
  const nextIndex = Math.round(elementInput.valueAsNumber * (numSlides - 1));
  moveSlide(nextIndex);
}

function moveSlide(targetIndex) {
  if (currentSlideIndex === targetIndex) return;

  for (let i = 0; i < numSlides; i++) {
    let targetX = SLIDE_SPACING_X * (i - targetIndex);
    let targetZ = 0;
    let targetRotationY = 0;

    if (i < targetIndex) {
      targetX -= PLANE_WIDTH * 0.6;
      targetZ = PLANE_WIDTH;
      targetRotationY = +45 * (Math.PI / 180);
    } else if (i > targetIndex) {
      targetX += PLANE_WIDTH * 0.6;
      targetZ = PLANE_WIDTH;
      targetRotationY = -45 * (Math.PI / 180);
    }

    const slide = slides[i];
    gsap.to(slide.position, { x: targetX, z: -targetZ, duration: 1.8, ease: "expo.out", overwrite: true });
    gsap.to(slide.rotation, { y: targetRotationY, duration: 0.9, ease: "expo.out", overwrite: true });
  }

  currentSlideIndex = targetIndex;
  updatePlayer(albumData[targetIndex]);
}

// ── Resize & render loop ──────────────────────────────────────────────────────

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function tick() {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ── SlideCard ─────────────────────────────────────────────────────────────────

class SlideCard extends THREE.Object3D {
  constructor(album) {
    super();
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(
      album.image_url,
      undefined,
      undefined,
      (err) => console.error(`Failed to load texture for ${album.title}:`, err)
    );

    const topPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT),
      new THREE.MeshLambertMaterial({ map: texture })
    );
    this.add(topPlane);

    const reflectionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT),
      new THREE.MeshLambertMaterial({ map: texture, transparent: true, side: THREE.BackSide, opacity: 0.2 })
    );
    reflectionPlane.rotation.x = Math.PI;
    reflectionPlane.position.y = -PLANE_HEIGHT - 1;
    this.add(reflectionPlane);
  }
}

init();
