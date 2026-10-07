/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * AI Virtual Background & Green Screen Segmentation Processor
 * Features:
 *  - MediaPipe Selfie Segmentation (Fast Model 0 with Inference Lock)
 *  - Smart Chroma Key & Soft Silhouette Fallback (No awkward circle cutouts!)
 *  - Astronaut Suit: 1.36x Zoom for prominent helmet, Auto-Framing Face Tracker,
 *    and multi-layered Curved Glass Jar Visor with reflections, depth, and HUD.
 */

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

    // Auto-Framing face tracker state for astronaut
    this.faceTracker = {
      x: 0.5,       // normalized camera x center (0..1)
      y: 0.35,      // normalized camera y center (0..1)
      scale: 1.0,   // face scale factor
      hasFace: false
    };

    // Preload background images & MediaPipe immediately
    if (typeof window !== 'undefined') {
      this.preloadBackgrounds();
      // Lazy init MediaPipe after DOM is ready
      setTimeout(() => this.initMediaPipe().catch(() => {}), 800);
    }
  }

  // Preload background images
  preloadBackgrounds() {
    if (typeof window === 'undefined') return;
    const bgs = {
      studio: '/backgrounds/studio.jpg',
      rocket: '/backgrounds/rocket.jpg',
      nature: '/backgrounds/nature.jpg',
      moon: '/backgrounds/moon.jpg',
      astronaut: '/backgrounds/astronaut.jpg',
    };

    Object.entries(bgs).forEach(([key, url]) => {
      if (this.loadedImages[key]) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => {
        this.loadedImages[key] = img;
      };
    });
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
          script.onerror = (e) => reject(new Error('Failed to load MediaPipe SelfieSegmentation script'));
          document.head.appendChild(script);
        });
      }

      if (window.SelfieSegmentation) {
        const segmenter = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        // modelSelection 0 = general selfie (1MB, fast 30-60fps, low memory)
        // selfieMode false ensures standard orientation matching raw camera
        segmenter.setOptions({
          modelSelection: 0,
          selfieMode: false,
        });

        segmenter.onResults((results) => {
          this.renderSegmentedFrame(results);
          this.isInferencing = false;
        });

        await segmenter.initialize();
        this.segmenter = segmenter;
        this.isSegmenterReady = true;
        console.log('[VideoProcessor] MediaPipe AI Selfie Segmentation ready');
      }
    } catch (err) {
      console.warn('[VideoProcessor] MediaPipe failed to init, using Smart Chroma Fallback:', err);
    } finally {
      this.isSegmenterLoading = false;
    }
  }

  // Start processing a raw camera stream
  async start(rawStream, filter = 'none', onStreamUpdate = null) {
    this.rawStream = rawStream;
    this.activeFilter = filter;
    this.onStreamUpdate = onStreamUpdate;
    this.preloadBackgrounds();

    // Non-AI filters or 'none' don't need canvas canvas pipeline
    const aiFilters = ['blur', 'blur-light', 'blur-heavy', 'studio', 'rocket', 'nature', 'moon', 'astronaut'];
    if (!aiFilters.includes(filter)) {
      this.stopProcessing();
      return rawStream;
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

    // Ensure MediaPipe is initialized
    if (!this.isSegmenterReady && !this.isSegmenterLoading) {
      this.initMediaPipe().catch(() => {});
    }

    // Synchronize processedStream with live rawStream audio track
    const canvasTrack = this.canvas.captureStream(30).getVideoTracks()[0];
    const audioTrack = rawStream.getAudioTracks()[0];

    if (!this.processedStream || !this.processedStream.active) {
      const combinedTracks = [];
      if (canvasTrack) combinedTracks.push(canvasTrack);
      if (audioTrack) combinedTracks.push(audioTrack);
      this.processedStream = new MediaStream(combinedTracks);
    } else {
      // Remove stale audio tracks and attach the live microphone track
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
        this.start(this.rawStream, filter, this.onStreamUpdate).then((stream) => {
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
          // Render graceful smart fallback while model loads or if offline
          this.renderChromaOrSilhouetteFallback();
        }
      }

      this.animId = requestAnimationFrame(step);
    };

    this.animId = requestAnimationFrame(step);
  }

  // Analyze segmentation mask or downscaled video to auto-detect face bounding centroid
  updateFaceTracking(sourceImage, maskImage = null) {
    if (!this.maskCtx || !this.maskCanvas) return;
    const mw = this.maskCanvas.width;
    const mh = this.maskCanvas.height;

    let targetX = 0.5;
    let targetY = 0.35;
    let targetScale = 1.0;
    let detected = false;

    if (maskImage) {
      // Analyze segmentation mask: head is the topmost cluster of positive pixels
      this.maskCtx.drawImage(maskImage, 0, 0, mw, mh);
      const imgData = this.maskCtx.getImageData(0, 0, mw, mh).data;

      let topY = -1;
      let sumX = 0;
      let count = 0;
      let minX = mw;
      let maxX = 0;

      // Scan rows from top to find person head
      for (let y = 4; y < mh * 0.65; y++) {
        for (let x = 4; x < mw - 4; x++) {
          const idx = (y * mw + x) * 4;
          // In MediaPipe mask, white/alpha > 120 indicates person
          if (imgData[idx] > 100 || imgData[idx + 3] > 100) {
            if (topY === -1) topY = y;
            if (topY !== -1 && y < topY + mh * 0.35) {
              sumX += x;
              count++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
            }
          }
        }
      }

      if (count > 25 && topY !== -1) {
        targetX = (sumX / count) / mw;
        targetY = (topY + mh * 0.16) / mh;
        const headSpan = Math.max(12, maxX - minX);
        targetScale = Math.min(1.4, Math.max(0.75, 45 / headSpan));
        detected = true;
      }
    }

    if (!detected) {
      // Native FaceDetector fallback if available
      if (typeof window !== 'undefined' && window.FaceDetector && !this.nativeFaceCheck) {
        this.nativeFaceCheck = true;
        try {
          const detector = new window.FaceDetector({ fastMode: true });
          detector.detect(sourceImage).then(faces => {
            if (faces && faces.length > 0) {
              const f = faces[0].boundingBox;
              const cx = (f.x + f.width * 0.5) / (sourceImage.videoWidth || sourceImage.width || 1280);
              const cy = (f.y + f.height * 0.5) / (sourceImage.videoHeight || sourceImage.height || 720);
              this.faceTracker.x += (cx - this.faceTracker.x) * 0.25;
              this.faceTracker.y += (cy - this.faceTracker.y) * 0.25;
            }
          }).catch(() => {});
        } catch (_) {}
      }
    }

    // Smooth exponential interpolation (lerp) for smooth cinematic camera tracking
    const smoothFactor = detected ? 0.18 : 0.06;
    this.faceTracker.x += (targetX - this.faceTracker.x) * smoothFactor;
    this.faceTracker.y += (targetY - this.faceTracker.y) * smoothFactor;
    this.faceTracker.scale += (targetScale - this.faceTracker.scale) * smoothFactor;
    this.faceTracker.hasFace = detected;
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
      // Draw slightly zoomed Astronaut background
      this.drawZoomedAstronautBackground(ctx, width, height);
    }

    // 2. Render User
    if (this.activeFilter === 'astronaut') {
      // Auto-frame face into astronaut helmet visor with glass shield
      this.updateFaceTracking(results.image, results.segmentationMask);
      this.renderAstronautVisor(ctx, results.image, width, height, results.segmentationMask);
    } else {
      // Standard Virtual Background / Blur: Extract person with mask and mirror face naturally
      pCtx.save();
      pCtx.clearRect(0, 0, width, height);
      pCtx.translate(width, 0);
      pCtx.scale(-1, 1);
      pCtx.drawImage(results.image, 0, 0, width, height);
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(results.segmentationMask, 0, 0, width, height);
      pCtx.restore();

      // Composite extracted person over background
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
      
      // Visor in source astronaut.jpg is located at:
      // Center X: 695, Center Y: 248, Radius X: 62, Radius Y: 86
      // Cinematic portrait framing: 1.62x zoom focused on astronaut chest & helmet
      const zoom = 1.62;
      const sw = iw / zoom;
      const sh = ih / zoom;
      const sx = 695 - sw * 0.50; // Center visor horizontally
      const sy = 248 - sh * 0.33; // Visor positioned at ~33% height (natural head level)

      ctx.drawImage(astroImg, sx, sy, sw, sh, 0, 0, width, height);

      // Compute exact canvas visor coordinates matching the rendered background
      this.currentVisor = {
        vx: (695 - sx) * (width / sw),
        vy: (248 - sy) * (height / sh),
        vrx: 62 * (width / sw),
        vry: 86 * (height / sh)
      };
    } else {
      // Space starry background fallback
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

  // Render astronaut helmet visor: Only face visible, with curved glass shield & HUD
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

    // 3. User Face Placement (Centered & ONLY Cover Face)
    const camW = imageSource.videoWidth || imageSource.width || 1280;
    const camH = imageSource.videoHeight || imageSource.height || 720;

    const faceX = this.faceTracker.x;
    const faceY = this.faceTracker.y;
    const faceScale = Math.max(0.85, this.faceTracker.scale);

    // Tight head crop (zoom in on head/face to fit inside helmet visor)
    const cropW = Math.min(camW, (camW * 0.36) / faceScale);
    const cropH = Math.min(camH, (camH * 0.44) / faceScale);
    const cropX = Math.max(0, Math.min(camW - cropW, faceX * camW - cropW * 0.5));
    const cropY = Math.max(0, Math.min(camH - cropH, faceY * camH - cropH * 0.46));

    // Save context for mirrored face drawing
    pCtx.save();
    pCtx.translate(vx, vy);
    pCtx.scale(-1, 1); // Natural mirror orientation for user's face
    pCtx.translate(-vx, -vy);

    if (maskSource) {
      // Use segmentation mask to extract ONLY person (no room / wall background)
      // Draw segmented face
      pCtx.drawImage(
        imageSource,
        cropX, cropY, cropW, cropH,
        vx - vrx * 1.05, vy - vry * 1.02, vrx * 2.1, vry * 2.04
      );

      // Fade out torso & clothes below chin into the dark helmet neck collar
      pCtx.globalCompositeOperation = 'destination-in';
      const neckFade = pCtx.createLinearGradient(vx, vy - vry * 0.9, vx, vy + vry * 0.95);
      neckFade.addColorStop(0.0, 'rgba(0,0,0,1)');
      neckFade.addColorStop(0.70, 'rgba(0,0,0,1)');
      neckFade.addColorStop(0.92, 'rgba(0,0,0,0.65)');
      neckFade.addColorStop(1.0, 'rgba(0,0,0,0.0)');
      pCtx.fillStyle = neckFade;
      pCtx.fillRect(vx - vrx * 1.2, vy - vry * 1.2, vrx * 2.4, vry * 2.4);
    } else {
      // Fallback: Tight oval vignette around face only
      pCtx.drawImage(
        imageSource,
        cropX, cropY, cropW, cropH,
        vx - vrx * 1.05, vy - vry * 1.02, vrx * 2.1, vry * 2.04
      );

      pCtx.globalCompositeOperation = 'destination-in';
      const softFaceVignette = pCtx.createRadialGradient(
        vx, vy - vry * 0.05, vrx * 0.55,
        vx, vy, Math.max(vrx, vry) * 0.98
      );
      softFaceVignette.addColorStop(0.0, 'rgba(0,0,0,1)');
      softFaceVignette.addColorStop(0.72, 'rgba(0,0,0,0.95)');
      softFaceVignette.addColorStop(1.0, 'rgba(0,0,0,0.0)');
      pCtx.fillStyle = softFaceVignette;
      pCtx.fillRect(vx - vrx * 1.2, vy - vry * 1.2, vrx * 2.4, vry * 2.4);
    }
    pCtx.restore();
    pCtx.restore();

    // Composite face inside helmet onto main canvas
    ctx.drawImage(this.personCanvas, 0, 0);

    // ============================================================
    // 4. REALISTIC MULTI-LAYERED CURVED GLASS HELMET VISOR SHIELD
    // ============================================================
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
    shieldSheen.addColorStop(0.0, 'rgba(235, 185, 45, 0.20)');  // Apollo gold coating
    shieldSheen.addColorStop(0.45, 'rgba(255, 220, 100, 0.08)');
    shieldSheen.addColorStop(0.70, 'rgba(70, 190, 255, 0.06)'); // Earth reflection
    shieldSheen.addColorStop(1.0, 'rgba(220, 175, 40, 0.14)');
    ctx.fillStyle = shieldSheen;
    ctx.fill();

    // Glass Layer 3: Primary Curved Specular Sunlight Glare Arc
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx - vrx * 0.32, vy - vry * 0.40, vrx * 0.62, vry * 0.42, -0.32, 0, Math.PI * 2);
    const sunGlareArc = ctx.createLinearGradient(
      vx - vrx * 0.70, vy - vry * 0.75,
      vx, vy
    );
    sunGlareArc.addColorStop(0.0, 'rgba(255, 255, 255, 0.68)');
    sunGlareArc.addColorStop(0.25, 'rgba(255, 255, 255, 0.32)');
    sunGlareArc.addColorStop(0.65, 'rgba(210, 240, 255, 0.06)');
    sunGlareArc.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = sunGlareArc;
    ctx.fill();
    ctx.restore();

    // Glass Layer 4: Secondary Horizon / Earthlight Reflection (Bottom-Right Rim)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx + vrx * 0.36, vy + vry * 0.44, vrx * 0.52, vry * 0.34, 0.36, 0, Math.PI * 2);
    const earthGlow = ctx.createLinearGradient(
      vx + vrx * 0.65, vy + vry * 0.70,
      vx, vy
    );
    earthGlow.addColorStop(0.0, 'rgba(80, 210, 255, 0.36)');
    earthGlow.addColorStop(0.50, 'rgba(80, 200, 255, 0.10)');
    earthGlow.addColorStop(1.0, 'rgba(80, 190, 255, 0.0)');
    ctx.fillStyle = earthGlow;
    ctx.fill();
    ctx.restore();

    // Glass Layer 5: Futuristic Visor HUD Telemetry (100% Upright & Crisp)
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#00F0FF';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
    ctx.shadowBlur = 5;

    // Left HUD indicators
    ctx.fillText('● EVA ACTIVE', vx - vrx * 0.72, vy - vry * 0.66);
    ctx.fillText('O₂ 98.4%', vx - vrx * 0.72, vy + vry * 0.76);

    // Right HUD telemetry
    ctx.fillText('P 4.3 PSI', vx + vrx * 0.18, vy + vry * 0.76);
    ctx.fillText('NOMINAL', vx + vrx * 0.18, vy - vry * 0.66);
    ctx.restore();

    ctx.restore();

    // 5. Visor Gasket & Metallic Locking Rim
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(vx, vy, vrx, vry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#12161D'; // Dark rubberized helmet seal gasket
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(vx, vy, vrx + 2, vry + 2, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(218, 165, 32, 0.75)'; // Fine gold metallic bezel
    ctx.stroke();
    ctx.restore();
  }

  // Smart Chroma Key & Soft Silhouette Fallback
  // (Used when MediaPipe is loading or if offline - NO MORE CIRCLE CUTOUTS!)
  renderChromaOrSilhouetteFallback() {
    if (!this.ctx || !this.canvas || !this.videoElement) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const vid = this.videoElement;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.activeFilter.startsWith('blur')) {
      // Smooth background blur: draw video with soft center depth
      ctx.drawImage(vid, 0, 0, width, height);
      const blurAmount = this.activeFilter === 'blur-heavy' ? '18px' : '10px';
      ctx.save();
      ctx.filter = `blur(${blurAmount}) brightness(0.92)`;
      ctx.drawImage(vid, 0, 0, width, height);
      ctx.restore();

      // Sharp foreground portrait
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
      // Fallback astronaut suit with auto-framed visor
      this.drawZoomedAstronautBackground(ctx, width, height);
      this.renderAstronautVisor(ctx, vid, width, height);
    } else if (['studio', 'rocket', 'nature', 'moon'].includes(this.activeFilter)) {
      // Virtual background with smart foreground chroma/feathering
      const bgImg = this.loadedImages[this.activeFilter];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#1C1C1C';
        ctx.fillRect(0, 0, width, height);
      }

      // Check if green screen is present in camera feed
      const mw = 120;
      const mh = 68;
      this.maskCanvas.width = mw;
      this.maskCanvas.height = mh;
      this.maskCtx.drawImage(vid, 0, 0, mw, mh);
      const sample = this.maskCtx.getImageData(0, 0, mw, mh).data;

      let greenScreenCount = 0;
      for (let i = 0; i < sample.length; i += 16) {
        const r = sample[i];
        const g = sample[i + 1];
        const b = sample[i + 2];
        if (g > 65 && g > r * 1.25 && g > b * 1.25) {
          greenScreenCount++;
        }
      }

      const isGreenScreen = greenScreenCount > (sample.length / 16) * 0.15;

      this.personCtx.save();
      this.personCtx.clearRect(0, 0, width, height);
      this.personCtx.drawImage(vid, 0, 0, width, height);

      if (isGreenScreen) {
        // High-speed Canvas Chroma Keying
        const frame = this.personCtx.getImageData(0, 0, width, height);
        const d = frame.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (g > 60 && g > r * 1.25 && g > b * 1.25) {
            d[i + 3] = 0; // Transparent background
          }
        }
        this.personCtx.putImageData(frame, 0, 0);
      } else {
        // Natural soft-edge silhouette blend (no circle cutout!)
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
      }
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
