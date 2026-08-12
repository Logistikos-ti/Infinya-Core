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
   * Only used together with requirePresenceGap: how long the same code must
   * go unseen before it counts as a fresh presentation. Measured from the
   * last time the decoder saw it, so holding a barcode still keeps refreshing
   * the window and never auto-counts, while genuinely swapping units clears
   * it. Defaults to 600ms.
   *
   * This replaced a consecutive-miss counter, which deadlocked: any stray
   * detection reset the counter, so a second unit of the same product could
   * not be scanned without restarting the camera.
   */
  presenceGapMs?: number;
};

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: "Permissão negada. Libere o uso da câmera no navegador e tente novamente.",
  NotFoundError: "Nenhuma câmera foi encontrada neste dispositivo.",
  NotReadableError: "A câmera está ocupada por outro aplicativo ou navegador.",
  OverconstrainedError: "Não foi possível usar esta câmera com as configurações solicitadas.",
  AbortError: "A inicialização da câmera foi interrompida. Tente novamente.",
  // Some older iOS Safari versions grant the permission prompt but then never
  // resolve getUserMedia/video.play() -- without a timeout that hangs
  // forever on "Preparando câmera...". Surfacing it as a real, actionable
  // error (instead of a silent freeze) is the whole point of this entry.
  TimeoutError: "A câmera demorou demais para iniciar neste aparelho. Feche esta tela, aguarde alguns segundos e tente novamente.",
};

/**
 * Races a promise against a timeout so a stalled getUserMedia/video.play()
 * call (seen on some older iOS Safari versions -- the permission prompt
 * appears, but the stream never actually starts) fails with a clear,
 * actionable error instead of hanging on "Preparando câmera..." forever.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const error = new Error("TimeoutError");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        window.clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

/**
 * Requests a camera stream with the given video constraints, racing it
 * against a timeout. If the underlying getUserMedia call ends up resolving
 * anyway after the timeout already gave up, the stray stream is stopped
 * immediately instead of leaving the camera light on for nothing.
 */
async function requestCameraStream(
  videoConstraints: MediaTrackConstraints | boolean,
  timeoutMs: number,
): Promise<MediaStream> {
  let settled = false;
  const streamPromise = navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });

  streamPromise.then((lateStream) => {
    if (settled) {
      lateStream.getTracks().forEach((track) => track.stop());
    }
  }, () => undefined);

  try {
    return await withTimeout(streamPromise, timeoutMs);
  } finally {
    settled = true;
  }
}

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

/**
 * Decodes a barcode from a still image (as opposed to a live video feed --
 * used by the capture-fallback path below). Tries the native BarcodeDetector
 * first when available, then falls back to zxing. Returns null rather than
 * throwing when nothing decodes, so the caller can show a friendly retry
 * message instead of a hard error.
 */
async function decodeStaticImage(
  source: HTMLImageElement,
  detector: BarcodeDetectorLike | null,
): Promise<string | null> {
  if (detector) {
    try {
      const results = await detector.detect(source);
      const code = results.find((item) => item.rawValue?.trim())?.rawValue?.trim();
      if (code) {
        return code;
      }
    } catch {
      // Fall through to zxing below.
    }
  }

  try {
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

    const reader = new BrowserMultiFormatReader(hints);
    const result = await reader.decodeFromImageElement(source);
    return result.getText()?.trim() || null;
  } catch {
    return null;
  }
}

function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, revoke: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("ImageLoadError"));
    };
    image.src = url;
  });
}

/**
 * Some older iOS Safari builds never fire a usable `play()` resolution if
 * it's called immediately after `srcObject` is assigned -- the black
 * screen + eventual timeout this caused is a well-known WebKit quirk.
 * Waiting for the video element to actually report it has metadata (or
 * data) first reliably avoids it. This never rejects: if neither event
 * fires within the timeout, it resolves anyway so play() still gets a
 * chance to run and fail with its own clear error instead of hanging here.
 */
function waitForLoadedMetadata(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (video.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("loadedmetadata", finish);
      video.removeEventListener("loadeddata", finish);
      resolve();
    };

    video.addEventListener("loadedmetadata", finish, { once: true });
    video.addEventListener("loadeddata", finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

export function useCameraBarcodeScanner({
  onDetected,
  successCooldownMs = 1500,
  requirePresenceGap = false,
  confirmReads = 1,
  presenceGapMs = 600,
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
  const presentCodeLastSeenAtRef = useRef(0);
  const pendingReadCodeRef = useRef<string>("");
  const pendingReadCountRef = useRef(0);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  // Some devices (confirmed: iPhone X on iOS 16.7.x running this app as a
  // home-screen "standalone" web app) never get a live camera stream
  // working at all -- getUserMedia grants permission but the stream never
  // actually starts, with no JS-level fix available (a WebKit limitation,
  // not a bug in this app). When live camera setup fails, this flips on so
  // the UI can offer a one-photo-at-a-time fallback instead: the OS Camera
  // app opens directly (bypassing the browser's broken video pipeline
  // entirely), the operator takes a photo of the barcode, and it's decoded
  // from that still image.
  const [captureFallbackActive, setCaptureFallbackActive] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

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
        const seenAt = Date.now();
        // Measured from the last sighting rather than from a miss counter, so
        // this self-heals: even if the decoder never reports a clean "no code"
        // frame, a real gap between sightings still counts as a new unit.
        const wasAway = seenAt - presentCodeLastSeenAtRef.current >= presenceGapMs;
        const isSameCodeStillInView = presentCodeRef.current === normalizedCode && !wasAway;

        presentCodeLastSeenAtRef.current = seenAt;

        if (isSameCodeStillInView) {
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
    [onDetected, successCooldownMs, requirePresenceGap, presenceGapMs],
  );

  const registerRawDetection = useCallback(
    (rawCode: string) => {
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

  /**
   * A frame decoded nothing. Only the confirm-reads streak is reset here --
   * releasing the held code is driven purely by how long it has gone unseen
   * (see emitDetection), so a flaky decoder cannot deadlock the scanner.
   */
  const markMiss = useCallback(() => {
    pendingReadCodeRef.current = "";
    pendingReadCountRef.current = 0;
  }, []);

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
    presentCodeLastSeenAtRef.current = 0;
    pendingReadCodeRef.current = "";
    pendingReadCountRef.current = 0;
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
      // Setting the attribute alone is not always picked up in time by
      // older iOS Safari builds before the stream is attached -- the JS
      // property is the more reliable of the two.
      videoElement.playsInline = true;
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

      // 1280x720 is broadly compatible; asking for 1920x1080 as "ideal" made
      // some older cameras/devices stall during constraint negotiation
      // instead of just falling back to a lower resolution.
      //
      // Some iOS Safari versions -- particularly standalone (home-screen
      // installed) web apps -- never resolve getUserMedia at all when it's
      // called with a constraints object (even a modest "ideal" one), but
      // do resolve it for the bare `{ video: true }` form. If the
      // constrained request doesn't settle quickly, fall back to the
      // simplest possible request instead of only ever failing the same way.
      let stream: MediaStream;
      try {
        stream = await requestCameraStream(
          { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          6000,
        );
      } catch {
        stream = await requestCameraStream(true, 8000);
      }

      streamRef.current = stream;
      videoElement.srcObject = stream;
      // Give the element a chance to actually report it has a frame ready
      // before calling play() -- see waitForLoadedMetadata.
      await waitForLoadedMetadata(videoElement, 4000);
      await withTimeout(videoElement.play(), 6000);

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
      setCaptureFallbackActive(false);
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
      // Live video is not working on this device -- offer the one-photo
      // fallback instead of leaving the operator stuck with no way to scan.
      setCaptureFallbackActive(true);
      setCameraMessage(
        CAMERA_ERROR_MESSAGES[errorName] ??
          "Não foi possível iniciar a câmera neste dispositivo.",
      );
    }
  }, [cameraSupported, cleanupStream, markMiss, nativeDetectorSupported, registerRawDetection, runNativeDetectorLoop]);

  /**
   * Opens the device's native camera app to take a single photo (via a
   * hidden `<input type="file" capture>`) and decodes a barcode from it.
   * Must be called directly from a user gesture (e.g. a button's onClick)
   * for iOS to allow it to open without extra friction.
   */
  const captureFromPhoto = useCallback(() => {
    if (typeof document === "undefined" || captureBusy) {
      return;
    }

    let input = fallbackInputRef.current;
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.setAttribute("capture", "environment");
      input.style.position = "fixed";
      input.style.top = "-9999px";
      input.style.left = "-9999px";
      input.style.opacity = "0";
      document.body.appendChild(input);
      fallbackInputRef.current = input;
    }

    input.value = "";
    input.onchange = () => {
      const file = input?.files?.[0];
      if (!file) {
        return;
      }

      setCaptureBusy(true);
      setCameraMessage("Lendo código da foto...");

      void (async () => {
        let revoke: (() => void) | null = null;
        try {
          const { image, revoke: revokeUrl } = await loadImageFromFile(file);
          revoke = revokeUrl;
          const code = await decodeStaticImage(image, detectorRef.current);

          if (!mountedRef.current) {
            return;
          }

          if (code) {
            // Deliberately bypasses registerRawDetection: its confirmReads
            // streak and requirePresenceGap dedup exist to filter noisy
            // continuous video frames. A single captured photo is already
            // one deliberate, unambiguous reading -- running it through
            // those live-video filters (e.g. confirmReads: 2) would mean it
            // could never actually fire onDetected.
            onDetected(normalizeCode(code));
            setCameraMessage("Código lido! Toque em \"Tirar foto\" novamente para o próximo, se precisar.");
          } else {
            setCameraMessage("Não conseguimos ler um código nessa foto. Aproxime mais e tente de novo.");
          }
        } catch {
          if (mountedRef.current) {
            setCameraMessage("Não foi possível processar a foto. Tente novamente.");
          }
        } finally {
          revoke?.();
          if (mountedRef.current) {
            setCaptureBusy(false);
          }
        }
      })();
    };

    input.click();
  }, [captureBusy, onDetected]);

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

      const input = fallbackInputRef.current;
      if (input) {
        input.onchange = null;
        input.remove();
        fallbackInputRef.current = null;
      }
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
    /** True once live camera setup has failed on this device -- see the
     * comment where this is set for why. Consuming screens should show a
     * "Tirar foto" button wired to captureFromPhoto when this is true. */
    captureFallbackActive,
    /** True while a captured photo is being decoded. */
    captureBusy,
    captureFromPhoto,
  };
}
