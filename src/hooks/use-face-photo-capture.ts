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

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    alignedStreakRef.current = 0;
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
          setFaceAligned(alignedStreakRef.current > 0);
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          // Portrait-ish (3:4), not the square 1280x1280 this used to
          // request: forcing a square frame from a sensor that isn't
          // square made the browser crop hard to hit that ratio, and with
          // object-fit: cover stretching that already-cropped square to
          // fill a tall phone screen, it read as an aggressive zoom.
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
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
      // same either way -- automatic detection, when it works, just means
      // the operator may never need to tap it.
      setCameraMessage("Encaixe o rosto na moldura ou toque para capturar.");
      if (detectorRef.current) {
        runFaceDetectionLoop();
      }
    } catch (error) {
      cleanupStream();
      if (!mountedRef.current) return;

      const errorName = error instanceof Error && error.name ? error.name : "UnknownCameraError";
      setCameraStarting(false);
      setCameraEnabled(false);
      setCameraMessage(CAMERA_ERROR_MESSAGES[errorName] ?? "Não foi possível iniciar a câmera neste dispositivo.");
    }
  }, [cameraSupported, cleanupStream, faceDetectionSupported, runFaceDetectionLoop]);

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
    /** Manual fallback for browsers without automatic face detection. */
    captureManually: capture,
  };
}
