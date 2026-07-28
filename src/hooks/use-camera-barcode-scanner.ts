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
  /**
   * When true, a code is only re-accepted after it has left the frame at
   * least once (a "miss" is observed) instead of after successCooldownMs
   * elapses. Use this when the same physical barcode may need to be
   * scanned multiple times in a row (e.g. picking several units of the
   * same product) and holding it in front of the camera should not
   * silently keep counting.
   */
  requirePresenceGap?: boolean;
  /**
   * How many consecutive frames must decode to the same code before it is
   * accepted. Filters one-off misreads (motion blur, partial frames) that
   * would otherwise flash as a wrong-code error right before the real
   * read comes through. Defaults to 1 (accept on the first frame, same as
   * before this option existed).
   */
  confirmReads?: number;
  /**
   * Only used together with requirePresenceGap: how many consecutive
   * no-code frames are required before a held code is considered to have
   * left the frame. A single dropped frame from autofocus/motion should
   * not be enough to let the same physical barcode re-count itself.
   * Defaults to 1.
   */
  confirmMisses?: number;
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
  requirePresenceGap = false,
  confirmReads = 1,
  confirmMisses = 1,
}: UseCameraBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControlsLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const loopRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const lastCodeRef = useRef<string>("");
  const lastDetectedAtRef = useRef<number>(0);
  const presentCodeRef = useRef<string>("");
  const pendingReadCodeRef = useRef<string>("");
  const pendingReadCountRef = useRef(0);
  const missStreakRef = useRef(0);

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

      if (requirePresenceGap) {
        if (presentCodeRef.current === normalizedCode) {
          return;
        }
        presentCodeRef.current = normalizedCode;
        onDetected(normalizedCode);
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
    [onDetected, successCooldownMs, requirePresenceGap],
  );

  const registerRawDetection = useCallback(
    (rawCode: string) => {
      missStreakRef.current = 0;

      const normalizedCode = normalizeCode(rawCode);
      if (!normalizedCode) {
        return;
      }

      if (confirmReads <= 1) {
        emitDetection(normalizedCode);
        return;
      }

      if (pendingReadCodeRef.current === normalizedCode) {
        pendingReadCountRef.current += 1;
      } else {
        pendingReadCodeRef.current = normalizedCode;
        pendingReadCountRef.current = 1;
      }

      if (pendingReadCountRef.current >= confirmReads) {
        emitDetection(normalizedCode);
      }
    },
    [confirmReads, emitDetection],
  );

  const markMiss = useCallback(() => {
    pendingReadCodeRef.current = "";
    pendingReadCountRef.current = 0;

    if (!requirePresenceGap) {
      return;
    }

    missStreakRef.current += 1;
    if (missStreakRef.current >= confirmMisses) {
      presentCodeRef.current = "";
    }
  }, [requirePresenceGap, confirmMisses]);

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

    presentCodeRef.current = "";
    pendingReadCodeRef.current = "";
    pendingReadCountRef.current = 0;
    missStreakRef.current = 0;
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
          registerRawDetection(code);
          if (mountedRef.current) {
            setCameraMessage("Câmera ativa. Aponte para o código de barras.");
          }
        } else {
          markMiss();
        }
      } catch {
        markMiss();
        if (mountedRef.current) {
          setCameraMessage("A câmera está ativa, mas a leitura automática falhou neste momento.");
        }
      }

      loopRef.current = window.requestAnimationFrame(loop);
    };

    loopRef.current = window.requestAnimationFrame(loop);
  }, [registerRawDetection, markMiss]);

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
            registerRawDetection(result.getText());
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
            markMiss();
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
  }, [cameraSupported, cleanupStream, markMiss, nativeDetectorSupported, registerRawDetection, runNativeDetectorLoop]);

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
