"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FancySelectOption = {
  value: string;
  label: string;
};

type FancySelectInputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: FancySelectOption[];
  disabled?: boolean;
};

export function FancySelectInput({
  label,
  name,
  value,
  onChange,
  options,
  disabled = false,
}: FancySelectInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1" ref={containerRef}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className={cn(
          "flex h-[52px] w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm text-slate-950 outline-none transition",
          "border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)] hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)]",
          "focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus-visible:ring-cyan-900/40",
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 hover:border-slate-200 hover:shadow-none dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-700"
            : "",
        )}
      >
        <span className="truncate">{selectedOption?.label ?? "Selecionar"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform dark:text-slate-300",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={`${name}-${option.value || "empty"}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition",
                    selected
                      ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
                  )}
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
