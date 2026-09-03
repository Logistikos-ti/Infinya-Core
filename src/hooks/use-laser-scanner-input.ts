"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Porta enxuta do padrão de coletor a laser já estabelecido em
 * src/components/shipping/shipping-picking-panel.tsx (input dedicado +
 * auto-foco + Enter + beep) para um hook reutilizável. Um coletor
 * USB/Bluetooth padrão funciona como teclado: "digita" o código lido
 * seguido de Enter num campo em foco -- não há nada a detectar além disso
 * (sem timing entre teclas, sem debounce: cada Enter é uma leitura
 * deliberada do operador).
 *
 * Não usado pelos painéis de picking/conferência existentes (que mantêm a
 * própria implementação) -- só pelos componentes novos de inventário
 * desktop, para não arriscar um refactor não pedido em código já em
 * produção.
 */

export type LaserScannerFeedbackTone = "success" | "error";

export function useLaserScannerInput({
  onScan,
  enabled = true,
  soundEnabled = true,
}: {
  onScan: (code: string) => void;
  /** Falso pausa o auto-foco (ex.: um modal de confirmação está na frente). */
  enabled?: boolean;
  soundEnabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [enabled, value]);

  function focusInput() {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function playFeedbackTone(tone: LaserScannerFeedbackTone) {
    if (!soundEnabled || typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;

    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone === "success" ? "sine" : "square";
    oscillator.frequency.value = tone === "success" ? 880 : 220;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (tone === "success" ? 0.08 : 0.16));
    oscillator.onended = () => void context.close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = value.trim();
    setValue("");
    if (!code) return;
    onScan(code);
  }

  return { inputRef, value, setValue, handleKeyDown, focusInput, playFeedbackTone };
}
