"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseInactivityTimeoutOptions = {
  warningAfterMs?: number;
  expireAfterMs?: number;
  disabled?: boolean;
  onExpire: () => void;
};

const DEFAULT_WARNING_AFTER_MS = 5_000;
const DEFAULT_EXPIRE_AFTER_MS = 35_000;

export function useInactivityTimeout({
  warningAfterMs = DEFAULT_WARNING_AFTER_MS,
  expireAfterMs = DEFAULT_EXPIRE_AFTER_MS,
  disabled = false,
  onExpire,
}: UseInactivityTimeoutOptions) {
  const warningWindowMs = Math.max(1_000, expireAfterMs - warningAfterMs);
  const warningWindowSeconds = useMemo(
    () => Math.max(1, Math.ceil(warningWindowMs / 1000)),
    [warningWindowMs],
  );

  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(warningWindowSeconds);

  const onExpireRef = useRef(onExpire);
  const warningTimeoutRef = useRef<number | null>(null);
  const expireTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const expireAtRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const clearTimers = useCallback(() => {
    if (warningTimeoutRef.current !== null) {
      window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }

    if (expireTimeoutRef.current !== null) {
      window.clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = null;
    }

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setIsWarningVisible(true);
    setCountdownSeconds(warningWindowSeconds);
    expireAtRef.current = Date.now() + warningWindowMs;

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = window.setInterval(() => {
      const expireAt = expireAtRef.current;
      if (!expireAt) {
        return;
      }

      const remainingMs = expireAt - Date.now();
      if (remainingMs <= 0) {
        setCountdownSeconds(0);
        if (countdownIntervalRef.current !== null) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        return;
      }

      setCountdownSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
    }, 250);

    expireTimeoutRef.current = window.setTimeout(() => {
      expiredRef.current = true;
      clearTimers();
      setIsWarningVisible(false);
      setCountdownSeconds(0);
      onExpireRef.current();
    }, warningWindowMs);
  }, [clearTimers, warningWindowMs, warningWindowSeconds]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    expiredRef.current = false;
    expireAtRef.current = null;
    setIsWarningVisible(false);
    setCountdownSeconds(warningWindowSeconds);

    warningTimeoutRef.current = window.setTimeout(() => {
      if (expiredRef.current) {
        return;
      }

      startCountdown();
    }, warningAfterMs);
  }, [clearTimers, startCountdown, warningAfterMs, warningWindowSeconds]);

  const resetTimer = useCallback(() => {
    if (disabled) {
      return;
    }

    scheduleTimers();
  }, [disabled, scheduleTimers]);

  useEffect(() => {
    if (disabled) {
      expiredRef.current = false;
      clearTimers();
      setIsWarningVisible(false);
      setCountdownSeconds(warningWindowSeconds);
      return;
    }

    const handleActivity = () => {
      if (expiredRef.current) {
        return;
      }

      scheduleTimers();
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    scheduleTimers();
    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );

    return () => {
      clearTimers();
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [clearTimers, disabled, scheduleTimers, warningWindowSeconds]);

  return {
    isWarningVisible,
    countdownSeconds,
    resetTimer,
  };
}
