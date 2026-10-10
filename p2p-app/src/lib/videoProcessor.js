/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * AI Virtual Background & Green Screen Segmentation Processor
 * Features:
 *  - Lazy-loaded AI models (loads on-demand only when user selects an effect)
 *  - Multi-Tier Computer Vision Face Alignment & Auto-Zoom Engine
 *    (Native window.FaceDetector, MediaPipe Face Detection, and Chrominance Tracking)
 *  - Astronaut Helmet: Real-time face centroid tracking, optical sightline alignment,
 *    and ~2.2x auto-zoom to fit helmet visor comfortably from forehead to chin
 *  - Curved Glass Jar Visor with sunlight glares, Earth reflections, and HUD telemetry
 */

class FaceAlignmentEngine {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.nativeDetector = null;
    this.mpDetector = null;
    this.isMpDetecting = false;
    this.lastDetectedTime = 0;
    // Smoothed face tracking coordinates (normalized 0..1)
    this.state = {
      cx: 0.5,
      cy: 0.38,
      width: 0.22,
      height: 0.30,
      hasFace: false
    };
  }

  async load(onProgress) {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;
    onProgress?.(true, 'Initializing Face Alignment & CV Models...');

    try {
      // 1. Native Chromium FaceDetector (Hardware Accelerated, Zero Download, 60fps)
      if (typeof window !== 'undefined' && window.FaceDetector) {
        try {
          this.nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          this.isLoaded = true;
          this.isLoading = false;
          onProgress?.(false, '');
          return;
        } catch (_) {}
      }

      // 2. MediaPipe Face Detection (BlazeFace CDN)
      if (typeof window !== 'undefined' && !window.FaceDetection) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => resolve(); // Gracefully fall back to CV skin/feature clustering
          document.head.appendChild(script);
        });
      }

      if (typeof window !== 'undefined' && window.FaceDetection) {
        const fd = new window.FaceDetection({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`
        });
        fd.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
        fd.onResults((res) => {
          if (res.detections && res.detections.length > 0) {
            const b = res.detections[0].boundingBox;
            this.updateFromBox(b.xCenter, b.yCenter, b.width, b.height);
          }
        });
        await fd.initialize().catch(() => {});
        this.mpDetector = fd;
      }
    } catch (e) {
      console.warn('[FaceAlignment] Model load notice:', e);
    } finally {
      this.isLoaded = true;
      this.isLoading = false;
      onProgress?.(false, '');
    }
  }

  updateFromBox(cx, cy, w, h) {
    const alpha = 0.24; // Exponential moving average for silky smooth 60fps tracking
    this.state.cx += (cx - this.state.cx) * alpha;
    this.state.cy += (cy - this.state.cy) * alpha;
    this.state.width += (w - this.state.width) * alpha;
    this.state.height += (h - this.state.height) * alpha;
    this.state.hasFace = true;
  }

  detect(videoElement, maskCanvas) {
    if (!videoElement || videoElement.readyState < 2) return this.state;

    // A. Native FaceDetector
    if (this.nativeDetector) {
      const now = performance.now();
      if (now - this.lastDetectedTime > 66) {
        this.lastDetectedTime = now;
        this.nativeDetector.detect(videoElement).then((faces) => {
          if (faces && faces.length > 0) {
            const b = faces[0].boundingBox;
            const vw = videoElement.videoWidth || 1280;
            const vh = videoElement.videoHeight || 720;
            const cx = (b.x + b.width * 0.5) / vw;
            const cy = (b.y + b.height * 0.45) / vh;
            const w = b.width / vw;
            const h = b.height / vh;
            this.updateFromBox(cx, cy, w, h);
          }
        }).catch(() => {});
      }
      return this.state;
    }

    // B. MediaPipe Face Detection
    if (this.mpDetector && !this.isMpDetecting) {
      const now = performance.now();
      if (now - this.lastDetectedTime > 80) {
        this.lastDetectedTime = now;
        this.isMpDetecting = true;
        this.mpDetector.send({ image: videoElement })
          .catch(() => {})
          .finally(() => { this.isMpDetecting = false; });
      }
      return this.state;
    }

    // C. Computer Vision Skin Tone & Facial Feature Cluster Centroid Detector (Fastest zero-dependency CV)
    if (maskCanvas) {
      const mw = maskCanvas.width;
      const mh = maskCanvas.height;
      const ctx = maskCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, mw, mh);
        const imgData = ctx.getImageData(0, 0, mw, mh).data;
        let sumX = 0, sumY = 0, count = 0;
        let minX = mw, maxX = 0, minY = mh, maxY = 0;

        for (let y = 4; y < mh * 0.72; y += 2) {
          for (let x = 4; x < mw - 4; x += 2) {
            const i = (y * mw + x) * 4;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) > 12 && Math.abs(r - g) < 140) {
              sumX += x;
              sumY += y;
              count++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (count > 20) {
          const cx = (sumX / count) / mw;
          const cy = (sumY / count) / mh;
          const w = Math.max(0.16, Math.min(0.48, (maxX - minX) / mw));
          const h = Math.max(0.20, Math.min(0.55, (maxY - minY) / mh));
          this.updateFromBox(cx, cy, w, h);
        }
      }
    }

    return this.state;
  }
}

class VideoBackgroundProcessor {
  constructor() {
    this.activeFilter = 'none';
    this.rawStream = null;
    this.processedStream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.personCanvas = null;
    this.personCtx = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.animId = null;
    this.segmenter = null;
    this.isSegmenterLoading = false;
    this.isSegmenterReady = false;
    this.isInferencing = false;
    this.loadedImages = {};
    this.onStreamUpdate = null;
    this.onLoadingProgress = null;

    // Face alignment engine
    this.faceAlignment = new FaceAlignmentEngine();
  }

  // Lazy load assets only when user chooses an effect
  async lazyLoadFilterAssets(filter, onProgress) {
    if (typeof window === 'undefined') return;

    // 1. Background image (lazy loaded on-demand)
    const bgs = {
      studio: '/backgrounds/studio.jpg',
      rocket: '/backgrounds/rocket.jpg',
      nature: '/backgrounds/nature.jpg',
      moon: '/backgrounds/moon.jpg',
      astronaut: '/backgrounds/astronaut.jpg',
    };

    if (bgs[filter] && !this.loadedImages[filter]) {
      const label = filter.charAt(0).toUpperCase() + filter.slice(1);
      onProgress?.(true, `Loading ${label} Background...`);
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bgs[filter];
        img.onload = () => {
          this.loadedImages[filter] = img;
          resolve();
        };
        img.onerror = () => resolve();
      });
    }

    // 2. Face Alignment & CV model (lazy loaded on-demand for astronaut / portrait)
    if (filter === 'astronaut') {
      await this.faceAlignment.load(onProgress);
    }

    // 3. MediaPipe Selfie Segmentation (lazy loaded on-demand)
    if (!this.isSegmenterReady && !this.isSegmenterLoading) {
      onProgress?.(true, 'Initializing AI Segmentation...');
      await this.initMediaPipe();
    }
  }

  // Dynamically load MediaPipe Selfie Segmentation via CDN
  async initMediaPipe() {
    if (this.isSegmenterReady || this.isSegmenterLoading) return;
    if (typeof window === 'undefined') return;
    this.isSegmenterLoading = true;

    try {
      if (!window.SelfieSegmentation) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load MediaPipe SelfieSegmentation'));
          document.head.appendChild(script);
        });
      }

      if (window.SelfieSegmentation) {
        const segmenter = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        segmenter.setOptions({
          modelSelection: 0, // Fast model, low memory
          selfieMode: false,
        });

        segmenter.onResults((results) => {
          this.renderSegmentedFrame(results);
          this.isInferencing = false;
        });

        await segmenter.initialize();
        this.segmenter = segmenter;
        this.isSegmenterReady = true;
        console.log('[VideoProcessor] MediaPipe AI Segmentation ready');
      }
    } catch (err) {
      console.warn('[VideoProcessor] MediaPipe fallback:', err);
    } finally {
      this.isSegmenterLoading = false;
    }
  }

  // Start processing a raw camera stream
  async start(rawStream, filter = 'none', onStreamUpdate = null, onLoadingProgress = null) {
    this.rawStream = rawStream;
    this.activeFilter = filter;
    this.onStreamUpdate = onStreamUpdate;
    this.onLoadingProgress = onLoadingProgress;

    const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];
    if (!aiFilters.includes(filter)) {
      this.stopProcessing();
      return rawStream;
    }

    // Lazy load the models and background assets for this chosen filter
    try {
      this.onLoadingProgress?.(true, 'Loading AI Model & Green Screen Effect...');
      await this.lazyLoadFilterAssets(filter, this.onLoadingProgress);
    } finally {
      this.onLoadingProgress?.(false, '');
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: false });

      this.personCanvas = document.createElement('canvas');
      this.personCanvas.width = 1280;
      this.personCanvas.height = 720;
      this.personCtx = this.personCanvas.getContext('2d', { willReadFrequently: true });

      // Downscaled canvas for face auto-framing and chroma analysis
      this.maskCanvas = document.createElement('canvas');
      this.maskCanvas.width = 160;
      this.maskCanvas.height = 90;
      this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }

    this.videoElement.srcObject = rawStream;
    await this.videoElement.play().catch(() => {});

    // Synchronize processedStream with live rawStream audio track
    const canvasTrack = this.canvas.captureStream(30).getVideoTracks()[0];
    const audioTrack = rawStream.getAudioTracks()[0];

    if (!this.processedStream || !this.processedStream.active) {
      const combinedTracks = [];
      if (canvasTrack) combinedTracks.push(canvasTrack);
      if (audioTrack) combinedTracks.push(audioTrack);
      this.processedStream = new MediaStream(combinedTracks);
    } else {
      this.processedStream.getAudioTracks().forEach(t => {
        try { this.processedStream.removeTrack(t); } catch (_) {}
      });
      if (audioTrack) {
        try { this.processedStream.addTrack(audioTrack); } catch (_) {}
      }
    }

    this.runLoop();
    return this.processedStream;
  }

  setFilter(filter) {
    this.activeFilter = filter;
    const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];
    if (!aiFilters.includes(filter)) {
      this.stopProcessing();
      if (this.onStreamUpdate && this.rawStream) {
        this.onStreamUpdate(this.rawStream);
      }
    } else {
      if (!this.animId && this.rawStream) {
        this.start(this.rawStream, filter, this.onStreamUpdate, this.onLoadingProgress).then((stream) => {
          if (this.onStreamUpdate) this.onStreamUpdate(stream);
        });
      }
    }
  }

  runLoop() {
    if (this.animId) cancelAnimationFrame(this.animId);

    const step = () => {
      const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];
      if (!aiFilters.includes(this.activeFilter)) return;

      const vid = this.videoElement;
      if (vid && vid.readyState >= 2 && vid.videoWidth > 0 && !vid.paused) {
        if (this.isSegmenterReady && this.segmenter && !this.isInferencing) {
          this.isInferencing = true;
          this.segmenter.send({ image: vid })
            .catch(() => {
              this.isInferencing = false;
              this.renderChromaOrSilhouetteFallback();
            });
        } else if (!this.isSegmenterReady) {
          this.renderChromaOrSilhouetteFallback();
        }
      }

      this.animId = requestAnimationFrame(step);
    };

    this.animId = requestAnimationFrame(step);
  }

  // Render segmented frame when MediaPipe result arrives
  renderSegmentedFrame(results) {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const pCtx = this.personCtx;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background
    if (this.activeFilter.startsWith('blur')) {
      const blurAmount = this.activeFilter === 'blur-heavy' ? '24px' : '14px';
      ctx.save();
      ctx.filter = `blur(${blurAmount}) brightness(0.92)`;
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.restore();
    } else if (['studio', 'rocket', 'nature', 'moon'].includes(this.activeFilter)) {
      const bgImg = this.loadedImages[this.activeFilter];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, width, height);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#1C1C1C');
        grad.addColorStop(1, '#0D0D0D');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    } else if (this.activeFilter === 'astronaut') {
      this.drawZoomedAstronautBackground(ctx, width, height);
    }

    // 2. Render User
    if (this.activeFilter === 'astronaut') {
      this.renderAstronautVisor(ctx, results.image, width, height, results.segmentationMask);
    } else {
      pCtx.save();
      pCtx.clearRect(0, 0, width, height);
      pCtx.translate(width, 0);
      pCtx.scale(-1, 1);
      pCtx.drawImage(results.image, 0, 0, width, height);
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(results.segmentationMask, 0, 0, width, height);
      pCtx.restore();

      ctx.drawImage(this.personCanvas, 0, 0);
    }

    ctx.restore();
  }

  // Draw astronaut background accurately fitted to frame
  drawZoomedAstronautBackground(ctx, width, height) {
    const astroImg = this.loadedImages.astronaut || this.loadedImages.moon;
    if (astroImg && astroImg.complete && astroImg.naturalWidth > 0) {
      const iw = astroImg.naturalWidth;  // 1376
      const ih = astroImg.naturalHeight; // 768
      
      const zoom = 1.62;
      const sw = iw / zoom;
      const sh = ih / zoom;
      const sx = 695 - sw * 0.50; // Center visor horizontally
      const sy = 248 - sh * 0.33; // Visor positioned at natural head level

      ctx.drawImage(astroImg, sx, sy, sw, sh, 0, 0, width, height);

      // Compute exact canvas visor coordinates matching the rendered background
      this.currentVisor = {
        vx: (695 - sx) * (width / sw),
        vy: (248 - sy) * (height / sh),
        vrx: 62 * (width / sw),
        vry: 86 * (height / sh)
      };
    } else {
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.3, 50, width * 0.5, height * 0.5, width * 0.7);
      grad.addColorStop(0, '#101B2B');
      grad.addColorStop(1, '#05070B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      this.currentVisor = {
        vx: width * 0.50,
        vy: height * 0.33,
        vrx: width * 0.075,
        vry: height * 0.18
      };
    }
  }

  // Render astronaut helmet visor: Face centered, auto-zoomed to fill visor, with glass reflections & HUD
  renderAstronautVisor(ctx, imageSource, width, height, maskSource = null) {
    const visor = this.currentVisor || {
      vx: width * 0.50,
      vy: height * 0.33,
      vrx: width * 0.075,
      vry: height * 0.18
    };
    const { vx, vy, vrx, vry } = visor;

    const pCtx = this.personCtx;
    pCtx.save();
    pCtx.clearRect(0, 0, width, height);

    // 1. Clip exclusively to the helmet visor aperture
    pCtx.beginPath();
    pCtx.ellipse(vx, vy, vrx, vry, 0, 0, Math.PI * 2);
    pCtx.clip();

    // 2. Helmet Interior Cavity: Deep space-black padded neck ring & lining
    const innerCavity = pCtx.createRadialGradient(vx, vy, vrx * 0.2, vx, vy, Math.max(vrx, vry));
    innerCavity.addColorStop(0, '#0E1522');
    innerCavity.addColorStop(0.7, '#080B12');
    innerCavity.addColorStop(1.0, '#020305');
    pCtx.fillStyle = innerCavity;
    pCtx.fillRect(vx - vrx * 1.2, vy - vry * 1.2, vrx * 2.4, vry * 2.4);

    // 3. User Face Placement: AI Computer Vision Auto-Zoom & Visor Alignment
    const camW = imageSource.videoWidth || imageSource.width || 1280;
    const camH = imageSource.videoHeight || imageSource.height || 720;

    const face = this.faceAlignment.detect(this.videoElement, this.maskCanvas);

    // Center of user's face in camera pixels
    const fcx = face.cx * camW;
    const fcy = face.cy * camH;
    const fH = Math.max(camH * 0.16, Math.min(camH * 0.52, face.height * camH));

    // Auto-zoom calculation: Tight crop from crown of hair to chin (1.35x face height)
    // Scaled to match the exact aspect ratio of the helmet visor (vrx / vry)
    const cropH = fH * 1.35;
    const cropW = cropH * (vrx / vry);
    const cropX = Math.max(0, Math.min(camW - cropW, fcx - cropW * 0.5));
    const cropY = Math.max(0, Math.min(camH - cropH, fcy - cropH * 0.44)); // Align eyes at ~44% from top

    pCtx.save();
    pCtx.translate(vx, vy);
    pCtx.scale(-1, 1); // Natural mirror orientation
    pCtx.translate(-vx, -vy);

    // Draw zoomed and centered face onto visor aperture
    pCtx.drawImage(
      imageSource,
      cropX, cropY, cropW, cropH,
      vx - vrx * 1.02, vy - vry * 1.02, vrx * 2.04, vry * 2.04
    );

    // Soft gradient fade below chin into the dark helmet neck collar
    pCtx.globalCompositeOperation = 'destination-in';
    const neckFade = pCtx.createLinearGradient(vx, vy - vry * 0.95, vx, vy + vry * 0.95);
    neckFade.addColorStop(0.0, 'rgba(0,0,0,1)');
    neckFade.addColorStop(0.72, 'rgba(0,0,0,1)');
    neckFade.addColorStop(0.92, 'rgba(0,0,0,0.6)');
    neckFade.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    pCtx.fillStyle = neckFade;
    pCtx.fillRect(vx - vrx * 1.2, vy - vry * 1.2, vrx * 2.4, vry * 2.4);

    pCtx.restore();
    pCtx.restore();

    // Composite face onto main canvas
    ctx.drawImage(this.personCanvas, 0, 0);

    // 4. Multi-Layered Curved Glass Helmet Visor Shield
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx, vy, vrx, vry, 0, 0, Math.PI * 2);
    ctx.clip();

    // Glass Layer 1: Spherical Convex Depth & Edge Vignette
    const glassDepth = ctx.createRadialGradient(
      vx - vrx * 0.15, vy - vry * 0.20, vrx * 0.35,
      vx, vy, Math.max(vrx, vry)
    );
    glassDepth.addColorStop(0, 'rgba(0, 10, 24, 0.0)');
    glassDepth.addColorStop(0.65, 'rgba(2, 12, 28, 0.14)');
    glassDepth.addColorStop(0.88, 'rgba(4, 16, 36, 0.38)');
    glassDepth.addColorStop(1.0, 'rgba(1, 6, 16, 0.76)');
    ctx.fillStyle = glassDepth;
    ctx.fill();

    // Glass Layer 2: Protective Apollo Gold & Celestial Blue Reflective Sheen
    const shieldSheen = ctx.createLinearGradient(vx - vrx, vy - vry, vx + vrx, vy + vry);
    shieldSheen.addColorStop(0.0, 'rgba(235, 185, 45, 0.20)');
    shieldSheen.addColorStop(0.45, 'rgba(255, 220, 100, 0.08)');
    shieldSheen.addColorStop(0.70, 'rgba(70, 190, 255, 0.06)');
    shieldSheen.addColorStop(1.0, 'rgba(220, 175, 40, 0.14)');
    ctx.fillStyle = shieldSheen;
    ctx.fill();

    // Glass Layer 3: Specular Sunlight Glare Arc
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx - vrx * 0.32, vy - vry * 0.40, vrx * 0.62, vry * 0.42, -0.32, 0, Math.PI * 2);
    const sunGlareArc = ctx.createLinearGradient(vx - vrx * 0.70, vy - vry * 0.75, vx, vy);
    sunGlareArc.addColorStop(0.0, 'rgba(255, 255, 255, 0.68)');
    sunGlareArc.addColorStop(0.25, 'rgba(255, 255, 255, 0.32)');
    sunGlareArc.addColorStop(0.65, 'rgba(210, 240, 255, 0.06)');
    sunGlareArc.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = sunGlareArc;
    ctx.fill();
    ctx.restore();

    // Glass Layer 4: Earthlight Horizon Glow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx + vrx * 0.36, vy + vry * 0.44, vrx * 0.52, vry * 0.34, 0.36, 0, Math.PI * 2);
    const earthGlow = ctx.createLinearGradient(vx + vrx * 0.65, vy + vry * 0.70, vx, vy);
    earthGlow.addColorStop(0.0, 'rgba(80, 210, 255, 0.36)');
    earthGlow.addColorStop(0.50, 'rgba(80, 200, 255, 0.10)');
    earthGlow.addColorStop(1.0, 'rgba(80, 190, 255, 0.0)');
    ctx.fillStyle = earthGlow;
    ctx.fill();
    ctx.restore();

    // Glass Layer 5: Visor HUD Telemetry
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#00F0FF';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
    ctx.shadowBlur = 5;
    ctx.fillText('● EVA ACTIVE', vx - vrx * 0.72, vy - vry * 0.66);
    ctx.fillText('O₂ 98.4%', vx - vrx * 0.72, vy + vry * 0.76);
    ctx.fillText('P 4.3 PSI', vx + vrx * 0.18, vy + vry * 0.76);
    ctx.fillText('NOMINAL', vx + vrx * 0.18, vy - vry * 0.66);
    ctx.restore();

    ctx.restore();

    // 5. Visor Gasket & Metallic Locking Rim
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx, vy, vrx, vry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#12161D';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(vx, vy, vrx + 2, vry + 2, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.75)';
    ctx.stroke();
    ctx.restore();
  }

  renderChromaOrSilhouetteFallback() {
    if (!this.ctx || !this.canvas || !this.videoElement) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const vid = this.videoElement;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.activeFilter.startsWith('blur')) {
      ctx.drawImage(vid, 0, 0, width, height);
      const blurAmount = this.activeFilter === 'blur-heavy' ? '18px' : '10px';
      ctx.save();
      ctx.filter = `blur(${blurAmount}) brightness(0.92)`;
      ctx.drawImage(vid, 0, 0, width, height);
      ctx.restore();

      const pGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 120, width * 0.5, height * 0.5, width * 0.45);
      pGrad.addColorStop(0, 'rgba(255,255,255,1)');
      pGrad.addColorStop(0.7, 'rgba(255,255,255,0.7)');
      pGrad.addColorStop(1, 'rgba(255,255,255,0)');
      this.personCtx.save();
      this.personCtx.clearRect(0, 0, width, height);
      this.personCtx.drawImage(vid, 0, 0, width, height);
      this.personCtx.globalCompositeOperation = 'destination-in';
      this.personCtx.fillStyle = pGrad;
      this.personCtx.fillRect(0, 0, width, height);
      this.personCtx.restore();
      ctx.drawImage(this.personCanvas, 0, 0);
    } else if (this.activeFilter === 'astronaut') {
      this.drawZoomedAstronautBackground(ctx, width, height);
      this.renderAstronautVisor(ctx, vid, width, height);
    } else if (['studio', 'rocket', 'nature', 'moon'].includes(this.activeFilter)) {
      const bgImg = this.loadedImages[this.activeFilter];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#1C1C1C';
        ctx.fillRect(0, 0, width, height);
      }

      this.personCtx.save();
      this.personCtx.clearRect(0, 0, width, height);
      this.personCtx.drawImage(vid, 0, 0, width, height);

      const softMask = this.personCtx.createRadialGradient(
        width * 0.5, height * 0.55, width * 0.22,
        width * 0.5, height * 0.55, width * 0.46
      );
      softMask.addColorStop(0, 'rgba(0,0,0,1)');
      softMask.addColorStop(0.75, 'rgba(0,0,0,0.85)');
      softMask.addColorStop(1, 'rgba(0,0,0,0)');
      this.personCtx.globalCompositeOperation = 'destination-in';
      this.personCtx.fillStyle = softMask;
      this.personCtx.fillRect(0, 0, width, height);
      this.personCtx.restore();

      ctx.drawImage(this.personCanvas, 0, 0);
    } else {
      ctx.drawImage(vid, 0, 0, width, height);
    }

    ctx.restore();
  }

  stopProcessing() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.processedStream) {
      this.processedStream.getVideoTracks().forEach(t => t.stop());
      this.processedStream = null;
    }
  }
}

export const videoProcessor = new VideoBackgroundProcessor();
