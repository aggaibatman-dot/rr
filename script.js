/* ============================================================
   ROLLS-ROYCE ENGINE EXPERIENCE — Main Script
   3-Sequence animation with Static Bookends & Custom Cursor
   ============================================================ */

(function () {
  'use strict';

  // ─── CONFIGURATION ────────────────────────────────────────
  const CONFIG = {
    // Three frame sequences — played in order
    sequences: [
      { name: 'Exterior', prefix: 'photos/frame_',  count: 96, padLength: 5 },
      { name: 'Engine',   prefix: 'photos/frame2_', count: 96, padLength: 5 },
      { name: 'Interior', prefix: 'photos/frame3_', count: 96, padLength: 5 },
    ],
    extension: '.jpg',

    // Multiplier for the sticky animation track height (e.g. 1400vh)
    scrollMultiplier: 14,
    lerpFactor: 0.08,

    // Visiblility ranges (scroll progress 0→1 exclusively within the animation track)
    sections: {
      intro:  { start: 0.05, end: 0.25 },
      engine: { start: 0.33, end: 0.50 },
      detail: { start: 0.55, end: 0.70 },
      luxury: { start: 0.75, end: 0.95 },
    },
  };

  // ─── DOM REFERENCES ───────────────────────────────────────
  const canvas         = document.getElementById('frame-canvas');
  const ctx            = canvas.getContext('2d');
  const loader         = document.getElementById('loader');
  const loaderFill     = document.getElementById('loader-fill');
  const loaderPercent  = document.getElementById('loader-percent');
  const scrollProgress = document.getElementById('scroll-progress');
  const animTrack      = document.getElementById('animation-track');

  const cursor         = document.getElementById('cursor');
  const cursorFollower = document.getElementById('cursor-follower');

  // Collect overlay content sections
  const sectionElements = {};
  document.querySelectorAll('.content-section').forEach(el => {
    sectionElements[el.dataset.section] = el;
  });

  // ─── STATE ────────────────────────────────────────────────
  const sequenceFrames = []; 
  let totalAllFrames = 0;    
  let currentFrame = 0;      
  let isLoaded = false;
  let rafId = null;

  // Custom Cursor state
  let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
  let posC  = { x: window.innerWidth/2, y: window.innerHeight/2 }; // primary dot
  let posF  = { x: window.innerWidth/2, y: window.innerHeight/2 }; // follower ring
  let isMobile = window.matchMedia("(max-width: 768px)").matches;

  // ─── GENERATE FRAME PATHS ────────────────────────────────
  function generateSequencePaths(seq) {
    const paths = [];
    for (let i = 1; i <= seq.count; i++) {
      const num = String(i).padStart(seq.padLength, '0');
      paths.push(`${seq.prefix}${num}${CONFIG.extension}`);
    }
    return paths;
  }

  // ─── PRELOAD ALL SEQUENCES ───────────────────────────────
  function preloadAllSequences() {
    return new Promise((resolve) => {
      let totalToLoad = 0;
      let totalLoaded = 0;

      for (const seq of CONFIG.sequences) {
        totalToLoad += seq.count;
      }
      totalAllFrames = totalToLoad;

      CONFIG.sequences.forEach((seq, seqIndex) => {
        sequenceFrames[seqIndex] = new Array(seq.count).fill(null);
        const paths = generateSequencePaths(seq);

        paths.forEach((src, frameIndex) => {
          const img = new Image();

          img.onload = () => {
            sequenceFrames[seqIndex][frameIndex] = img;
            totalLoaded++;
            updateLoader(totalLoaded, totalToLoad);
            if (totalLoaded === totalToLoad) resolve();
          };

          img.onerror = () => {
            sequenceFrames[seqIndex][frameIndex] = null;
            totalLoaded++;
            updateLoader(totalLoaded, totalToLoad);
            if (totalLoaded === totalToLoad) resolve();
          };

          img.src = src;
        });
      });
    });
  }

  function updateLoader(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    loaderFill.style.width = pct + '%';
    loaderPercent.textContent = pct + '%';
  }

  // ─── CANVAS SIZING ───────────────────────────────────────
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    isMobile = window.matchMedia("(max-width: 768px)").matches;
    
    // Set dynamic scrolljacking height
    animTrack.style.height = (window.innerHeight * CONFIG.scrollMultiplier) + 'px';

    if (isLoaded) renderAtProgress(getScrollProgress());
  }

  // ─── RENDER IMAGE ──────────────────────────────────────────
  function renderImage(img) {
    if (!img) return;

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    ctx.clearRect(0, 0, cw, ch);

    const imgR = img.naturalWidth / img.naturalHeight;
    const canR = cw / ch;
    let dw, dh, dx, dy;

    if (canR > imgR) {
      dw = cw; dh = cw / imgR; dx = 0; dy = (ch - dh) / 2;
    } else {
      dh = ch; dw = ch * imgR; dy = 0; dx = (cw - dw) / 2;
    }

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // ─── MAP SCROLL PROGRESS → SEQUENCE + FRAME ─────────────
  function getSequenceAndFrame(progress) {
    const numSeq = CONFIG.sequences.length;
    const segmentSize = 1 / numSeq; 

    let seqIndex = Math.floor(progress / segmentSize);
    seqIndex = Math.min(seqIndex, numSeq - 1); 

    const localProgress = (progress - seqIndex * segmentSize) / segmentSize;
    const clampedLocal = Math.max(0, Math.min(1, localProgress));

    const seqCount = CONFIG.sequences[seqIndex].count;
    const frameIndex = Math.round(clampedLocal * (seqCount - 1));

    return { seqIndex, frameIndex };
  }

  function findNearestValid(seqIndex, frameIndex) {
    const frames = sequenceFrames[seqIndex];
    if (!frames) return null;
    const len = frames.length;

    for (let offset = 0; offset < len; offset++) {
      if (frameIndex + offset < len && frames[frameIndex + offset]) return frames[frameIndex + offset];
      if (frameIndex - offset >= 0 && frames[frameIndex - offset]) return frames[frameIndex - offset];
    }
    return null;
  }

  function renderAtProgress(progress) {
    const { seqIndex, frameIndex } = getSequenceAndFrame(progress);
    let img = sequenceFrames[seqIndex]?.[frameIndex];

    if (!img) {
      img = findNearestValid(seqIndex, frameIndex);
    }

    if (img) renderImage(img);
  }

  // ─── SCROLL TRACK CALCULATION ────────────────────────────
  function getScrollProgress() {
    // Measure strictly within the #animation-track intersecting the viewport
    const rect = animTrack.getBoundingClientRect();
    const maxScroll = rect.height - window.innerHeight;
    const scrolled = -rect.top;
    
    // Bounds: 0 before track, 1 after track
    if (scrolled <= 0) return 0;
    if (scrolled >= maxScroll) return 1;
    
    return scrolled / maxScroll;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ─── SECTION VISIBILITY ──────────────────────────────────
  function updateSections(progress) {
    for (const [key, range] of Object.entries(CONFIG.sections)) {
      const el = sectionElements[key];
      if (!el) continue;

      let opacity = 0;

      // Bell-curve overlay logic
      if (progress >= range.start && progress <= range.end) {
        const center = (range.start + range.end) / 2;
        const half = (range.end - range.start) / 2;
        const dist = Math.abs(progress - center) / half;
        opacity = 1 - dist * dist;
      }

      opacity = Math.max(0, Math.min(1, opacity));
      el.style.opacity = String(opacity);

      if (opacity > 0.05) {
        el.classList.add('visible');
      } else {
        el.classList.remove('visible');
      }
    }
  }

  // ─── GLOBAL FRAME NUMBER ────────────────────────────────
  function getGlobalFrameIndex(progress) {
    const numSeq = CONFIG.sequences.length;
    const segmentSize = 1 / numSeq;
    let seqIndex = Math.min(Math.floor(progress / segmentSize), numSeq - 1);
    const localProgress = (progress - seqIndex * segmentSize) / segmentSize;
    const clampedLocal = Math.max(0, Math.min(1, localProgress));

    let globalOffset = 0;
    for (let i = 0; i < seqIndex; i++) {
      globalOffset += CONFIG.sequences[i].count;
    }

    const localFrame = Math.round(clampedLocal * (CONFIG.sequences[seqIndex].count - 1));
    return globalOffset + localFrame;
  }

  // ─── INTERACTIVE CURSOR INIT ─────────────────────────────
  function initCursor() {
    if (isMobile) return;

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    const interactives = document.querySelectorAll('a, button');
    interactives.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
  }

  // ─── ANIMATION LOOP ──────────────────────────────────────
  function animate() {
    if (!isLoaded) return;

    // --- 1. UI Scroll Engine ---
    const rawProgress = getScrollProgress();
    const smoothProgress = lerp(currentFrame / (totalAllFrames - 1), rawProgress, CONFIG.lerpFactor);
    
    renderAtProgress(smoothProgress);
    currentFrame = smoothProgress * (totalAllFrames - 1);

    // Fade scroll progress bar explicitly bound to animation track
    scrollProgress.style.width = (rawProgress * 100) + '%';
    
    // Overlays
    updateSections(rawProgress);

    // --- 2. Custom Cursor Lerp ---
    if (!isMobile && cursor && cursorFollower) {
      // primary dot is brisk
      posC.x = lerp(posC.x, mouse.x, 0.4);
      posC.y = lerp(posC.y, mouse.y, 0.4);
      cursor.style.transform = `translate(${posC.x}px, ${posC.y}px) translate(-50%, -50%)`;

      // follower circle is elastic / smooth
      posF.x = lerp(posF.x, mouse.x, 0.15);
      posF.y = lerp(posF.y, mouse.y, 0.15);
      cursorFollower.style.transform = `translate(${posF.x}px, ${posF.y}px) translate(-50%, -50%)`;
    }

    rafId = requestAnimationFrame(animate);
  }

  // ─── INITIALIZE ──────────────────────────────────────────
  async function init() {
    initCursor();
    resizeCanvas();

    await preloadAllSequences();

    isLoaded = true;
    currentFrame = 0;

    renderAtProgress(0);
    loader.classList.add('hidden');

    // Button event
    document.getElementById('replay-btn').addEventListener('click', () => {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' }); // Scroll past hero to start of track
    });

    rafId = requestAnimationFrame(animate);
  }

  // ─── EVENTS ──────────────────────────────────────────────
  window.addEventListener('resize', resizeCanvas);
  
  init();
})();
