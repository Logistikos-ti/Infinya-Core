"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseInactivityTimeoutOptions = {
  warningAfterMs?: number;
  expireAfterMs?: number;
  disabled?: boolean;
  onExpire: () => void;
};

const DEFAULT_WARNING_AFTER_MS = 30_000;
const DEFAULT_EXPIRE_AFTER_MS = 60_000;

export function useInactivityTimeout({
  warningAfterMs = DEFAULT_WARNING_AFTER_MS,
  expireAfterMs = DEFAULT_EXPIRE_AFTER_MS,
  disabled = false,
  onExpire,
}: UseInactivityTimeoutOptions) {
  const warningWindowSeconds = Math.max(
    1,
    Math.ceil((expireAfterMs - warningAfterMs) / 1000),
  );
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(warningWindowSeconds);
  const lastActivityRef = useRef(0);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    hasExpiredRef.current = false;
    setIsWarningVisible(false);
    setCountdownSeconds(warningWindowSeconds);
  }, [warningWindowSeconds]);

  useEffect(() => {
    if (disabled) {
      hasExpiredRef.current = false;
      return;
    }

    lastActivityRef.current = Date.now();
    hasExpiredRef.current = false;

    const syncState = () => {
      const elapsedMs = Date.now() - lastActivityRef.current;

      if (elapsedMs >= expireAfterMs) {
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current();
        }
        return;
      }

      if (elapsedMs >= warningAfterMs) {
        setIsWarningVisible(true);
        setCountdownSeconds(
          Math.max(0, Math.ceil((expireAfterMs - elapsedMs) / 1000)),
        );
        return;
      }

      setIsWarningVisible(false);
      setCountdownSeconds(warningWindowSeconds);
    };

    const handleActivity = () => {
      if (hasExpiredRef.current) {
        return;
      }

      lastActivityRef.current = Date.now();
      if (isWarningVisible) {
        setIsWarningVisible(false);
      }
      setCountdownSeconds(warningWindowSeconds);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    syncState();
    const intervalId = window.setInterval(syncState, 1_000);
    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );

    return () => {
      window.clearInterval(intervalId);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity),
      );
    };
  }, [
    disabled,
    expireAfterMs,
    isWarningVisible,
    resetTimer,
    warningAfterMs,
    warningWindowSeconds,
  ]);

  return {
    isWarningVisible,
    countdownSeconds,
    resetTimer,
  };
}
