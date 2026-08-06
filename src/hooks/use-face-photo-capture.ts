"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FaceDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ boundingBox: { width: number; height: number } }>>;
};

type FaceDetectorCtor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

type UseFacePhotoCaptureOptions = {
  onCaptured: (dataUrl: string) => void;
  /**
   * How many consecutive frames must show a well-framed face before the
   * photo is auto-captured. Filters a single lucky frame (blink, motion
   * blur) from triggering too early. Only relevant when the browser
   * supports automatic face detection.
   */
  confirmReads?: number;
  /**
   * Minimum face bounding-box width as a fraction of the video width for
   * the face to count as "close enough" to the camera to auto-capture.
   */
  minFaceWidthRatio?: number;
};

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: "Permissão negada. Libere o uso da câmera no navegador e tente novamente.",
  NotFoundError: "Nenhuma câmera foi encontrada neste dispositivo.",
  NotReadableError: "A câmera está ocupada por outro aplicativo ou navegador.",
  OverconstrainedError: "Não foi possível usar esta câmera com as configurações solicitadas.",
  AbortError: "A inicialização da câmera foi interrompida. Tente novamente.",
};

// Stillness-based auto-capture: doesn't depend on any browser detection API
// (FaceDetector is genuinely unreliable -- see below), just on the video
// feed having stopped changing frame-to-frame, which happens naturally once
// someone holds the phone up and stays framed. Works on every browser that
// can run getUserMedia + canvas at all.
const STABILITY_SAMPLE_SIZE = 48;
const STABILITY_INTERVAL_MS = 220;
const STABILITY_REQUIRED_STREAK = 5; // ~1.1s of stillness
const STABILITY_GRACE_MS = 1200; // let the operator get into position first
const STABILITY_DIFF_THRESHOLD = 10; // avg per-pixel (R channel) delta allowed

async function waitForVideoElement(getVideo: () => HTMLVideoElement | null, timeoutMs = 1200) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const video = getVideo();
    if (video) return video;
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }

  return null;
}

export function useFacePhotoCapture({
  onCaptured,
  confirmReads = 6,
  minFaceWidthRatio = 0.22,
}: UseFacePhotoCaptureOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetectorLike | null>(null);
  const loopRef = useRef<number | null>(null);
  const stabilityIntervalRef = useRef<number | null>(null);
  const stabilityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableStreakRef = useRef(0);
  const cameraStartedAtRef = useRef(0);
  const mountedRef = useRef(true);
  const alignedStreakRef = useRef(0);
  const capturedRef = useRef(false);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [faceAligned, setFaceAligned] = useState(false);

  const cameraSupported = useMemo(
    () => typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    [],
  );

  // Exists in several Chrome/Android builds without ever actually
  // returning a detection (behind an experimental flag internally), so
  // this is treated as a bonus accelerator, never the only capture path --
  // see the always-on stability loop below.
  const faceDetectionSupported = useMemo(() => typeof window !== "undefined" && "FaceDetector" in window, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const cleanupStream = useCallback(() => {
    if (loopRef.current) {
      window.cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }

    if (stabilityIntervalRef.current) {
      window.clearInterval(stabilityIntervalRef.current);
      stabilityIntervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    alignedStreakRef.current = 0;
    stableStreakRef.current = 0;
    previousFrameRef.current = null;
    capturedRef.current = false;
  }, []);

  const stopCamera = useCallback(
    (message?: string | null) => {
      cleanupStream();
      if (!mountedRef.current) return;

      setCameraStarting(false);
      setCameraEnabled(false);
      setFaceAligned(false);
      if (typeof message !== "undefined") setCameraMessage(message);
    },
    [cleanupStream],
  );

  const capture = useCallback(() => {
    if (capturedRef.current) return;
    const dataUrl = captureFrame();
    if (!dataUrl) return;

    capturedRef.current = true;
    onCaptured(dataUrl);
    stopCamera(null);
  }, [captureFrame, onCaptured, stopCamera]);

  const runFaceDetectionLoop = useCallback(() => {
    const loop = async () => {
      const detector = detectorRef.current;
      const video = videoRef.current;

      if (capturedRef.current) return;

      if (!detector || !video || video.readyState < 2) {
        loopRef.current = window.requestAnimationFrame(loop);
        return;
      }

      try {
        const faces = await detector.detect(video);
        const face = faces[0];
        const widthRatio = face ? face.boundingBox.width / video.videoWidth : 0;
        const isWellFramed = widthRatio >= minFaceWidthRatio;

        if (isWellFramed) {
          alignedStreakRef.current += 1;
        } else {
          alignedStreakRef.current = 0;
        }

        if (mountedRef.current) {
          setFaceAligned(alignedStreakRef.current > 0 || stableStreakRef.current > 0);
        }

        if (alignedStreakRef.current >= confirmReads) {
          capture();
          return;
        }
      } catch {
        alignedStreakRef.current = 0;
      }

      loopRef.current = window.requestAnimationFrame(loop);
    };

    loopRef.current = window.requestAnimationFrame(loop);
  }, [capture, confirmReads, minFaceWidthRatio]);

  // Always runs, regardless of FaceDetector support: samples a tiny
  // downscaled frame at a fixed interval and compares it to the previous
  // sample. Once the feed has been essentially unchanged for a short
  // streak (the operator has framed themself and is holding still), it
  // captures -- the same behavior a photo-booth timer gives you, without
  // needing to know anything about faces specifically.
  const runStabilityLoop = useCallback(() => {
    cameraStartedAtRef.current = Date.now();

    stabilityIntervalRef.current = window.setInterval(() => {
      if (capturedRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      if (!stabilityCanvasRef.current) {
        stabilityCanvasRef.current = document.createElement("canvas");
        stabilityCanvasRef.current.width = STABILITY_SAMPLE_SIZE;
        stabilityCanvasRef.current.height = STABILITY_SAMPLE_SIZE;
      }

      const canvas = stabilityCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, STABILITY_SAMPLE_SIZE, STABILITY_SAMPLE_SIZE);
      const frame = ctx.getImageData(0, 0, STABILITY_SAMPLE_SIZE, STABILITY_SAMPLE_SIZE).data;
      const previous = previousFrameRef.current;
      previousFrameRef.current = frame;

      if (!previous) return;

      let diffSum = 0;
      let samples = 0;
      for (let i = 0; i < frame.length; i += 4) {
        diffSum += Math.abs(frame[i] - previous[i]);
        samples += 1;
      }
      const avgDiff = diffSum / samples;
      const pastGracePeriod = Date.now() - cameraStartedAtRef.current > STABILITY_GRACE_MS;

      if (avgDiff < STABILITY_DIFF_THRESHOLD && pastGracePeriod) {
        stableStreakRef.current += 1;
      } else {
        stableStreakRef.current = 0;
      }

      if (mountedRef.current) {
        setFaceAligned(stableStreakRef.current > 0 || alignedStreakRef.current > 0);
      }

      if (stableStreakRef.current >= STABILITY_REQUIRED_STREAK) {
        capture();
      }
    }, STABILITY_INTERVAL_MS);
  }, [capture]);

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setCameraMessage("Câmera não suportada neste navegador.");
      return;
    }

    setCameraStarting(true);
    setCameraMessage("Preparando câmera...");
    capturedRef.current = false;

    try {
      cleanupStream();

      const videoElement = await waitForVideoElement(() => videoRef.current);
      if (!videoElement) throw new Error("VideoElementUnavailable");

      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("webkit-playsinline", "true");
      videoElement.muted = true;

      if (faceDetectionSupported) {
        const FaceDetectorRef = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
        if (FaceDetectorRef) {
          detectorRef.current = new FaceDetectorRef({ fastMode: true, maxDetectedFaces: 1 });
        }
      }

      // No width/height/aspectRatio hints -- forcing a specific resolution
      // or ratio (tried both a fixed portrait guess and one matched to the
      // viewport) kept making some devices' front camera return an
      // aggressively cropped stream to hit it, which then read as an
      // extreme zoom once displayed. Requesting just facingMode and
      // letting the device hand back its own default/natural stream is
      // the only setting that has stayed zoom-free -- object-fit: contain
      // below is what guarantees no cropping regardless of whatever
      // aspect ratio that stream turns out to be.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });

      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      if (!mountedRef.current) {
        cleanupStream();
        return;
      }

      setCameraEnabled(true);
      setCameraStarting(false);

      // The manual "Capturar foto" button is always shown once the camera
      // is enabled (see the client component), so this message stays the
      // same either way -- automatic capture, when it fires first, just
      // means the operator never needs to tap it.
      setCameraMessage("Encaixe o rosto na moldura. A foto é tirada automaticamente.");
      if (detectorRef.current) {
        runFaceDetectionLoop();
      }
      runStabilityLoop();
    } catch (error) {
      cleanupStream();
      if (!mountedRef.current) return;

      const errorName = error instanceof Error && error.name ? error.name : "UnknownCameraError";
      setCameraStarting(false);
      setCameraEnabled(false);
      setCameraMessage(CAMERA_ERROR_MESSAGES[errorName] ?? "Não foi possível iniciar a câmera neste dispositivo.");
    }
  }, [cameraSupported, cleanupStream, faceDetectionSupported, runFaceDetectionLoop, runStabilityLoop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    faceDetectionSupported,
    faceAligned,
    startCamera,
    stopCamera,
    /** Manual fallback -- always available, not just when detection is unsupported. */
    captureManually: capture,
  };
}
