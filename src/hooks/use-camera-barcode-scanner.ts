"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScannerControlsLike = {
  stop: () => void;
};

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type UseCameraBarcodeScannerOptions = {
  onDetected: (code: string) => void;
  successCooldownMs?: number;
};

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: "Permissão negada. Libere o uso da câmera no navegador e tente novamente.",
  NotFoundError: "Nenhuma câmera foi encontrada neste dispositivo.",
  NotReadableError: "A câmera está ocupada por outro aplicativo ou navegador.",
  OverconstrainedError: "Não foi possível usar esta câmera com as configurações solicitadas.",
  AbortError: "A inicialização da câmera foi interrompida. Tente novamente.",
};

async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  timeoutMs = 1200,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const video = getVideo();
    if (video) {
      return video;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }

  return null;
}

function normalizeCode(code: string) {
  return code.trim();
}

export function useCameraBarcodeScanner({
  onDetected,
  successCooldownMs = 1500,
}: UseCameraBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControlsLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const loopRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const lastCodeRef = useRef<string>("");
  const lastDetectedAtRef = useRef<number>(0);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);

  const cameraSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
    [],
  );

  const nativeDetectorSupported = useMemo(
    () => typeof window !== "undefined" && "BarcodeDetector" in window,
    [],
  );

  const emitDetection = useCallback(
    (code: string) => {
      const normalizedCode = normalizeCode(code);
      if (!normalizedCode) {
        return;
      }

      const now = Date.now();
      if (
        normalizedCode === lastCodeRef.current &&
        now - lastDetectedAtRef.current < successCooldownMs
      ) {
        return;
      }

      lastCodeRef.current = normalizedCode;
      lastDetectedAtRef.current = now;
      onDetected(normalizedCode);
    },
    [onDetected, successCooldownMs],
  );

  const cleanupStream = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

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
  }, []);

  const stopCamera = useCallback(
    (message?: string | null) => {
      cleanupStream();
      if (!mountedRef.current) {
        return;
      }

      setCameraStarting(false);
      setCameraEnabled(false);
      if (typeof message !== "undefined") {
        setCameraMessage(message);
      }
    },
    [cleanupStream],
  );

  const runNativeDetectorLoop = useCallback(() => {
    const loop = async () => {
      const detector = detectorRef.current;
      const video = videoRef.current;

      if (!detector || !video || video.readyState < 2) {
        loopRef.current = window.requestAnimationFrame(loop);
        return;
      }

      try {
        const results = await detector.detect(video);
        const code = results.find((item) => item.rawValue?.trim())?.rawValue?.trim() ?? "";

        if (code) {
          emitDetection(code);
          if (mountedRef.current) {
            setCameraMessage("Câmera ativa. Aponte para o código de barras.");
          }
        }
      } catch {
        if (mountedRef.current) {
          setCameraMessage("A câmera está ativa, mas a leitura automática falhou neste momento.");
        }
      }

      loopRef.current = window.requestAnimationFrame(loop);
    };

    loopRef.current = window.requestAnimationFrame(loop);
  }, [emitDetection]);

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setCameraMessage("Leitura por câmera não suportada neste navegador.");
      return;
    }

    setCameraStarting(true);
    setCameraMessage("Preparando câmera para leitura...");

    try {
      cleanupStream();

      const videoElement = await waitForVideoElement(() => videoRef.current);
      if (!videoElement) {
        throw new Error("VideoElementUnavailable");
      }

      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("webkit-playsinline", "true");
      videoElement.muted = true;

      if (nativeDetectorSupported) {
        const BarcodeDetectorRef = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
          .BarcodeDetector;

        if (BarcodeDetectorRef) {
          detectorRef.current = new BarcodeDetectorRef({
            formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
          });
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      if (detectorRef.current) {
        runNativeDetectorLoop();
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 90,
          delayBetweenScanSuccess: 400,
        });

        controlsRef.current = await reader.decodeFromVideoElement(videoElement, (result, error) => {
          if (result?.getText()) {
            emitDetection(result.getText());
            if (mountedRef.current) {
              setCameraMessage("Câmera ativa. Aponte para o código de barras.");
            }
            return;
          }

          const errorName = error?.name;
          if (
            !errorName ||
            errorName === "NotFoundException" ||
            errorName === "ChecksumException" ||
            errorName === "FormatException"
          ) {
            return;
          }

          if (mountedRef.current) {
            setCameraMessage("A câmera está ativa, mas a leitura falhou neste momento.");
          }
        });
      }

      if (!mountedRef.current) {
        cleanupStream();
        return;
      }

      setCameraEnabled(true);
      setCameraStarting(false);
      setCameraMessage("Câmera ativa. Aponte para o código de barras.");
    } catch (error) {
      cleanupStream();

      if (!mountedRef.current) {
        return;
      }

      const errorName =
        error instanceof Error && error.name ? error.name : "UnknownCameraError";
      setCameraStarting(false);
      setCameraEnabled(false);
      setCameraMessage(
        CAMERA_ERROR_MESSAGES[errorName] ??
          "Não foi possível iniciar a câmera neste dispositivo.",
      );
    }
  }, [cameraSupported, cleanupStream, emitDetection, nativeDetectorSupported, runNativeDetectorLoop]);

  const toggleCamera = useCallback(() => {
    if (cameraEnabled || cameraStarting) {
      stopCamera("Leitura por câmera pausada.");
      return;
    }

    void startCamera();
  }, [cameraEnabled, cameraStarting, startCamera, stopCamera]);

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
    startCamera,
    stopCamera,
    toggleCamera,
  };
}
