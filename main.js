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

  // Prefer timed cues (synced highlighting); fall back to plain text, then a placeholder.
  if (album.cues_url) {
    try {
      const res = await fetch(album.cues_url);
      if (res.ok) renderCues(await res.json());
      else flipTextContent.textContent = '（文件读取失败）';
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
