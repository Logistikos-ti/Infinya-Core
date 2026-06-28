"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScannerControlsLike = {
  stop: () => void;
};

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

export function useCameraBarcodeScanner({
  onDetected,
  successCooldownMs = 1500,
}: UseCameraBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControlsLike | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastDetectedAtRef = useRef<number>(0);
  const mountedRef = useRef(true);
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

  const cleanupStream = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    const currentVideo = videoRef.current;
    const currentStream = currentVideo?.srcObject;
    if (currentStream instanceof MediaStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    if (currentVideo) {
      currentVideo.pause();
      currentVideo.srcObject = null;
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

  const startCamera = useCallback(async () => {
    if (!cameraSupported || !videoRef.current) {
      setCameraMessage("Leitura por câmera não suportada neste navegador.");
      return;
    }

    setCameraStarting(true);
    setCameraMessage("Preparando câmera para leitura...");

    try {
      cleanupStream();

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
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 500,
      });

      const handleDetection = (code: string) => {
        const normalizedCode = code.trim();
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
      };

      const startWithConstraints = async (constraints: MediaStreamConstraints) =>
        reader.decodeFromConstraints(constraints, videoRef.current ?? undefined, (result, error) => {
          if (result?.getText()) {
            handleDetection(result.getText());
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

      let controls: ScannerControlsLike | null = null;

      try {
        controls = await startWithConstraints({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        controls = await startWithConstraints({
          video: true,
          audio: false,
        });
      }

      controlsRef.current = controls;

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
  }, [cameraSupported, cleanupStream, onDetected, successCooldownMs]);

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
