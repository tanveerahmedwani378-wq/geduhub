/**
 * Client-side video creation using Canvas + MediaRecorder
 */

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Create a video from a single image with Ken Burns (zoom/pan) effect
 */
export async function createVideoFromImage(
  imageUrl: string,
  duration: number = 5,
  effect: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' = 'zoom-in'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  const img = await loadImage(imageUrl);

  const fps = 30;
  const totalFrames = duration * fps;
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.onerror = () => reject(new Error('Recording failed'));
    recorder.start();

    let frame = 0;
    const render = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }

      const progress = frame / totalFrames;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let scale: number, offsetX: number, offsetY: number;

      switch (effect) {
        case 'zoom-in':
          scale = 1 + progress * 0.3;
          offsetX = (canvas.width * (scale - 1)) / 2;
          offsetY = (canvas.height * (scale - 1)) / 2;
          break;
        case 'zoom-out':
          scale = 1.3 - progress * 0.3;
          offsetX = (canvas.width * (scale - 1)) / 2;
          offsetY = (canvas.height * (scale - 1)) / 2;
          break;
        case 'pan-left':
          scale = 1.2;
          offsetX = progress * canvas.width * 0.2;
          offsetY = (canvas.height * (scale - 1)) / 2;
          break;
        case 'pan-right':
          scale = 1.2;
          offsetX = (1 - progress) * canvas.width * 0.2;
          offsetY = (canvas.height * (scale - 1)) / 2;
          break;
      }

      ctx.drawImage(img, -offsetX, -offsetY, canvas.width * scale, canvas.height * scale);

      frame++;
      requestAnimationFrame(render);
    };

    render();
  });
}

export interface SlideData {
  type: 'text' | 'image';
  content: string; // text content or image URL
  backgroundColor?: string;
  textColor?: string;
  duration: number; // seconds per slide
}

/**
 * Create a slideshow video from multiple slides with transitions
 */
export async function createSlideshowVideo(
  slides: SlideData[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;

  const fps = 30;
  const transitionFrames = 15; // 0.5s transition

  // Preload images
  const images: (HTMLImageElement | null)[] = [];
  for (const slide of slides) {
    if (slide.type === 'image') {
      try {
        images.push(await loadImage(slide.content));
      } catch {
        images.push(null);
      }
    } else {
      images.push(null);
    }
  }

  const totalSlideFrames = slides.reduce((sum, s) => sum + s.duration * fps, 0);
  const totalTransitionFrames = Math.max(0, (slides.length - 1) * transitionFrames);
  const totalFrames = totalSlideFrames + totalTransitionFrames;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  function drawSlide(index: number, alpha: number = 1) {
    const slide = slides[index];
    const img = images[index];

    ctx.globalAlpha = alpha;

    if (slide.type === 'image' && img) {
      // Draw image to fill canvas
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    } else {
      // Text slide
      ctx.fillStyle = slide.backgroundColor || '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = slide.textColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Word wrap
      const maxWidth = canvas.width * 0.8;
      const lines = wrapText(ctx, slide.content, maxWidth, 48);
      const lineHeight = 60;
      const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

      ctx.font = 'bold 48px sans-serif';
      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
      });
    }

    ctx.globalAlpha = 1;
  }

  function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
    context.font = `bold ${fontSize}px sans-serif`;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.onerror = () => reject(new Error('Recording failed'));
    recorder.start();

    let globalFrame = 0;

    const render = () => {
      if (globalFrame >= totalFrames) {
        recorder.stop();
        return;
      }

      onProgress?.(Math.round((globalFrame / totalFrames) * 100));

      // Determine which slide we're on
      let frameCount = 0;
      let currentSlide = 0;
      let isTransition = false;
      let transitionProgress = 0;

      for (let i = 0; i < slides.length; i++) {
        const slideFrames = slides[i].duration * fps;

        if (globalFrame < frameCount + slideFrames) {
          currentSlide = i;
          break;
        }
        frameCount += slideFrames;

        // Transition between slides
        if (i < slides.length - 1) {
          if (globalFrame < frameCount + transitionFrames) {
            currentSlide = i;
            isTransition = true;
            transitionProgress = (globalFrame - frameCount) / transitionFrames;
            break;
          }
          frameCount += transitionFrames;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isTransition && currentSlide < slides.length - 1) {
        // Cross-fade transition
        drawSlide(currentSlide, 1 - transitionProgress);
        drawSlide(currentSlide + 1, transitionProgress);
      } else {
        drawSlide(currentSlide);
      }

      globalFrame++;
      requestAnimationFrame(render);
    };

    render();
  });
}

/**
 * Download a video blob
 */
export function downloadVideo(blob: Blob, filename: string = 'video.webm') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
