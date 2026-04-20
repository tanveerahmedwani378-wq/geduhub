import * as THREE from 'three';

const FPS = 30;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const fetchAudioBuffer = async (
  ctx: AudioContext,
  url: string
): Promise<AudioBuffer | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch (e) {
    console.warn('Audio decode failed', e);
    return null;
  }
};

/**
 * Render a 3D parallax / camera-dolly scene from a single image, with optional audio.
 * Uses Three.js + WebGL canvas captured via MediaRecorder, mixed with WebAudio sources.
 */
export async function create3DVideoFromImage(
  imageUrl: string,
  opts: {
    durationSec?: number;
    width?: number;
    height?: number;
    sfxUrl?: string | null;
    musicUrl?: string | null;
  } = {}
): Promise<Blob> {
  const duration = opts.durationSec ?? 6;
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;

  const img = await loadImage(imageUrl);

  // --- Three.js setup ---
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 5);

  // Background subtle gradient sphere for depth
  const bgGeo = new THREE.SphereGeometry(40, 32, 32);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a14,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(bgGeo, bgMat));

  // Image as a displaced plane — gives 3D depth from the 2D AI image.
  // We use a high-segment plane and a vertex shader to push pixels based on luminance.
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const aspect = img.width / img.height;
  const planeH = 4;
  const planeW = planeH * aspect;

  const planeGeo = new THREE.PlaneGeometry(planeW, planeH, 200, 200);

  const planeMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex },
      uDepth: { value: 0.55 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform float uDepth;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec4 c = texture2D(uTex, uv);
        float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        // Push darker areas back, brighter areas forward — fake depth
        float disp = (lum - 0.5) * uDepth;
        // Subtle wave motion for life
        disp += sin(uv.x * 8.0 + uTime * 1.2) * 0.015;
        disp += cos(uv.y * 6.0 + uTime * 0.9) * 0.015;
        vec3 newPos = position + normal * disp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform float uTime;
      void main() {
        vec4 c = texture2D(uTex, vUv);
        // Subtle vignette
        vec2 q = vUv - 0.5;
        float v = 1.0 - dot(q, q) * 0.6;
        gl_FragColor = vec4(c.rgb * v, 1.0);
      }
    `,
  });

  const plane = new THREE.Mesh(planeGeo, planeMat);
  scene.add(plane);

  // Floating particles for cinematic atmosphere
  const particleCount = 200;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = Math.random() * 3 + 0.5;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.025,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // --- Audio setup ---
  const AudioCtx =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const dest = audioCtx.createMediaStreamDestination();

  const audioBuffers: Array<{ buf: AudioBuffer; gain: number }> = [];
  if (opts.sfxUrl) {
    const b = await fetchAudioBuffer(audioCtx, opts.sfxUrl);
    if (b) audioBuffers.push({ buf: b, gain: 0.85 });
  }
  if (opts.musicUrl) {
    const b = await fetchAudioBuffer(audioCtx, opts.musicUrl);
    if (b) audioBuffers.push({ buf: b, gain: 0.45 });
  }

  // Synthesized fallback nodes — guarantees the video always has sound
  // even when the AI audio service is unavailable.
  type SynthNode = {
    start: (t: number) => void;
    stop: (t: number) => void;
    connect: (n: AudioNode) => void;
  };
  const synthNodes: SynthNode[] = [];
  if (audioBuffers.length === 0) {
    console.info('[video3d] No AI audio — using synthesized cinematic pad + ambient noise.');

    // 1) Soft cinematic pad: layered detuned sine/triangle oscillators (C minor 9 chord)
    const padFreqs = [130.81, 196.0, 233.08, 311.13, 392.0]; // C3, G3, A#3, D#4, G4
    const padGain = audioCtx.createGain();
    padGain.gain.value = 0;
    padFreqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 8;
      const og = audioCtx.createGain();
      og.gain.value = 0.12 / padFreqs.length;
      osc.connect(og).connect(padGain);
      synthNodes.push({
        start: (t) => osc.start(t),
        stop: (t) => osc.stop(t),
        connect: () => {/* routed via padGain */},
      });
    });
    padGain.connect(dest);
    // Envelope
    padGain.gain.setValueAtTime(0, audioCtx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1.2);

    // 2) Ambient noise SFX bed (filtered white noise)
    const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.18;
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(dest);
    synthNodes.push({
      start: (t) => noiseSrc.start(t),
      stop: (t) => noiseSrc.stop(t),
      connect: () => {/* routed */},
    });

    // Fade-out tail
    padGain.gain.setValueAtTime(0.6, audioCtx.currentTime + duration - 0.8);
    padGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    noiseGain.gain.setValueAtTime(0.18, audioCtx.currentTime + duration - 0.8);
    noiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  }

  // --- Combined stream (video + audio) ---
  const videoStream = canvas.captureStream(FPS);
  const combined = new MediaStream();
  videoStream.getVideoTracks().forEach((t) => combined.addTrack(t));
  // Always attach the audio destination — either AI buffers OR synth fallback feed it.
  dest.stream.getAudioTracks().forEach((t) => combined.addTrack(t));

  // Pick best supported codec
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const mime =
    candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  recorder.start(100);

  // Start AI audio buffer sources
  const startAt = audioCtx.currentTime + 0.05;
  audioBuffers.forEach(({ buf, gain }) => {
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = buf.duration < duration;
    const g = audioCtx.createGain();
    g.gain.value = gain;
    g.gain.setValueAtTime(gain, startAt + duration - 0.6);
    g.gain.linearRampToValueAtTime(0, startAt + duration);
    src.connect(g).connect(dest);
    src.start(startAt);
    src.stop(startAt + duration + 0.05);
  });

  // Start synthesized fallback nodes (when AI audio unavailable)
  synthNodes.forEach((n) => {
    try {
      n.start(startAt);
      n.stop(startAt + duration + 0.05);
    } catch (e) {
      console.warn('synth node start failed', e);
    }
  });

  // --- Animation loop ---
  const totalFrames = duration * FPS;
  let frame = 0;
  const startTime = performance.now();

  return new Promise<Blob>((resolve, reject) => {
    const tick = () => {
      try {
        const t = frame / totalFrames; // 0..1
        const time = (performance.now() - startTime) / 1000;

        // Camera dolly + slight orbit
        const dolly = 5 - t * 1.8; // move closer
        const orbit = Math.sin(t * Math.PI * 2) * 0.6;
        camera.position.set(orbit, Math.sin(t * Math.PI) * 0.2, dolly);
        camera.lookAt(0, 0, 0);

        // Plane gentle rotation
        plane.rotation.y = Math.sin(t * Math.PI * 2) * 0.08;
        plane.rotation.x = Math.cos(t * Math.PI * 2) * 0.04;

        // Particle drift
        const pPos = particleGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          const y = pPos.getY(i) + 0.005;
          pPos.setY(i, y > 2.5 ? -2.5 : y);
        }
        pPos.needsUpdate = true;

        planeMat.uniforms.uTime.value = time;

        renderer.render(scene, camera);

        frame++;
        if (frame >= totalFrames) {
          recorder.stop();
          finished
            .then((blob) => {
              renderer.dispose();
              planeGeo.dispose();
              planeMat.dispose();
              particleGeo.dispose();
              particleMat.dispose();
              tex.dispose();
              audioCtx.close();
              resolve(blob);
            })
            .catch(reject);
          return;
        }
        requestAnimationFrame(tick);
      } catch (err) {
        reject(err);
      }
    };
    tick();
  });
}

export function downloadVideo(blob: Blob, filename = 'geduhub-video.webm') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
