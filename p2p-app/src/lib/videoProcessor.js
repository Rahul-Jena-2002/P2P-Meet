/*
 * p2pmeet - Decentralized Privacy-First Video Meetings
 * AI Virtual Background & Green Screen Segmentation Processor
 * Supports: Real Background Blur, Modern Studio, Rocket Cockpit, Nature, Moon & Astronaut Suit
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
    this.animId = null;
    this.segmenter = null;
    this.isSegmenterLoading = false;
    this.isSegmenterReady = false;
    this.loadedImages = {};
    this.astronautImg = null;
    this.onStreamUpdate = null;
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
    this.isSegmenterLoading = true;

    try {
      if (!window.SelfieSegmentation) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = (e) => reject(new Error('Failed to load MediaPipe SelfieSegmentation CDN'));
          document.head.appendChild(script);
        });
      }

      if (window.SelfieSegmentation) {
        const segmenter = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        segmenter.setOptions({
          modelSelection: 1, // 1 = landscape/full body, 0 = general/fast
          selfieMode: true,
        });

        segmenter.onResults((results) => {
          this.renderSegmentedFrame(results);
        });

        await segmenter.initialize();
        this.segmenter = segmenter;
        this.isSegmenterReady = true;
        console.log('[VideoProcessor] MediaPipe Selfie Segmentation initialized successfully');
      }
    } catch (err) {
      console.warn('[VideoProcessor] MediaPipe could not load, using Canvas Smart Chroma fallback:', err);
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

    if (filter === 'none') {
      this.stopProcessing();
      return rawStream;
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

      this.personCanvas = document.createElement('canvas');
      this.personCanvas.width = 1280;
      this.personCanvas.height = 720;
      this.personCtx = this.personCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }

    this.videoElement.srcObject = rawStream;
    await this.videoElement.play().catch(() => {});

    // Try loading MediaPipe if not ready
    if (!this.isSegmenterReady && !this.isSegmenterLoading) {
      this.initMediaPipe().catch(() => {});
    }

    // Capture processed canvas video stream
    const canvasStream = this.canvas.captureStream(30);
    const audioTrack = rawStream.getAudioTracks()[0];
    const combinedTracks = [...canvasStream.getVideoTracks()];
    if (audioTrack) combinedTracks.push(audioTrack);
    this.processedStream = new MediaStream(combinedTracks);

    this.runLoop();
    return this.processedStream;
  }

  setFilter(filter) {
    this.activeFilter = filter;
    if (filter === 'none') {
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

    const step = async () => {
      if (this.activeFilter === 'none') return;

      if (this.videoElement && this.videoElement.readyState >= 2) {
        if (this.isSegmenterReady && this.segmenter) {
          try {
            await this.segmenter.send({ image: this.videoElement });
          } catch (e) {
            this.renderFallbackFrame();
          }
        } else {
          this.renderFallbackFrame();
        }
      }

      this.animId = requestAnimationFrame(step);
    };

    this.animId = requestAnimationFrame(step);
  }

  // Render segmented frame when MediaPipe result arrives
  renderSegmentedFrame(results) {
    if (!this.ctx || !this.canvas || this.activeFilter === 'none') return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const pCtx = this.personCtx;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Background
    if (this.activeFilter === 'blur' || this.activeFilter === 'blur-light' || this.activeFilter === 'blur-heavy') {
      // Background Blur: Draw blurred camera frame
      const blurAmount = this.activeFilter === 'blur-heavy' ? '24px' : '12px';
      ctx.save();
      ctx.filter = `blur(${blurAmount}) brightness(0.95)`;
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.restore();
    } else if (['studio', 'rocket', 'nature', 'moon'].includes(this.activeFilter)) {
      // Virtual Background Image
      const bgImg = this.loadedImages[this.activeFilter];
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, width, height);
      } else {
        // Subtle dark space gradient if image loading
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#1C1C1C');
        grad.addColorStop(1, '#0D0D0D');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    } else if (this.activeFilter === 'astronaut') {
      // Moon with Astronaut Suit
      const astroImg = this.loadedImages.astronaut || this.loadedImages.moon;
      if (astroImg && astroImg.complete) {
        ctx.drawImage(astroImg, 0, 0, width, height);
      }
    }

    // 2. Extract Person using segmentation mask
    pCtx.save();
    pCtx.clearRect(0, 0, width, height);

    if (this.activeFilter === 'astronaut') {
      // For astronaut: Crop user face into center helmet visor
      // Helmet oval center: x = 50%, y = 28%, rx = 100px, ry = 135px
      pCtx.beginPath();
      pCtx.ellipse(width * 0.505, height * 0.275, width * 0.088, height * 0.175, 0, 0, Math.PI * 2);
      pCtx.clip();
      // Draw centered face video into visor
      pCtx.drawImage(results.image, width * 0.38, height * 0.08, width * 0.25, height * 0.40);
      pCtx.restore();

      // Composite user face onto astronaut canvas
      ctx.drawImage(this.personCanvas, 0, 0);

      // Add subtle helmet glass visor reflection curve
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(width * 0.505, height * 0.275, width * 0.088, height * 0.175, 0, 0, Math.PI * 2);
      const glassGrad = ctx.createLinearGradient(width * 0.45, height * 0.15, width * 0.55, height * 0.40);
      glassGrad.addColorStop(0, 'rgba(180, 225, 255, 0.28)');
      glassGrad.addColorStop(0.4, 'rgba(100, 200, 255, 0.05)');
      glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
      ctx.fillStyle = glassGrad;
      ctx.fill();
      ctx.restore();
    } else {
      // Standard Virtual Background / Blur: Draw person with mask
      pCtx.drawImage(results.image, 0, 0, width, height);
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.drawImage(results.segmentationMask, 0, 0, width, height);
      pCtx.restore();

      // Composite extracted person over background
      ctx.drawImage(this.personCanvas, 0, 0);
    }

    // 3. Optional Artistic Color Grading
    if (this.activeFilter === 'cinema') {
      ctx.fillStyle = 'rgba(0, 60, 90, 0.12)';
      ctx.fillRect(0, 0, width, height);
    } else if (this.activeFilter === 'warm') {
      ctx.fillStyle = 'rgba(255, 140, 0, 0.10)';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  // Fallback while MediaPipe model initializes or on low-power devices
  renderFallbackFrame() {
    if (!this.ctx || !this.canvas || !this.videoElement || this.activeFilter === 'none') return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.activeFilter.startsWith('blur')) {
      // Radial focus blur fallback: Sharp center for face, blurred edges
      ctx.drawImage(this.videoElement, 0, 0, width, height);
      const grad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, 'rgba(28,28,28,0.4)');
      grad.addColorStop(1, 'rgba(28,28,28,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (this.activeFilter === 'astronaut') {
      // Astronaut visor frame fallback
      const astroImg = this.loadedImages.astronaut;
      if (astroImg && astroImg.complete) {
        ctx.drawImage(astroImg, 0, 0, width, height);
        // Cutout face oval
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(width * 0.505, height * 0.275, width * 0.088, height * 0.175, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.videoElement, width * 0.38, height * 0.08, width * 0.25, height * 0.40);
        ctx.restore();
      } else {
        ctx.drawImage(this.videoElement, 0, 0, width, height);
      }
    } else if (['studio', 'rocket', 'nature', 'moon'].includes(this.activeFilter)) {
      const bgImg = this.loadedImages[this.activeFilter];
      if (bgImg && bgImg.complete) {
        ctx.drawImage(bgImg, 0, 0, width, height);
        // Render softened user tile over background
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(width / 2, height * 0.6, width * 0.26, height * 0.45, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(this.videoElement, width * 0.24, height * 0.15, width * 0.52, height * 0.85);
        ctx.restore();
      } else {
        ctx.drawImage(this.videoElement, 0, 0, width, height);
      }
    } else {
      ctx.drawImage(this.videoElement, 0, 0, width, height);
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
