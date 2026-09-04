"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

export type PillSelectOption = { value: string; label: string };

// Dropdown customizado — mesmo padrão do Infinoos Help (pílula, seta que
// gira, painel com check na opção ativa). Compartilhado entre as telas do
// WMS que precisam desse mesmo visual (ex: Suporte, formulário de usuário).
export function PillSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: PillSelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-[42px] min-w-[170px] cursor-pointer items-center justify-between gap-2 rounded-full border px-4 text-[13.5px] font-semibold outline-none transition-colors ${tokenBorder} ${tokenCardBg} ${tokenText} ${className}`}
        style={open ? { borderColor: "#5AA7FF", boxShadow: "0 0 0 3px rgba(90,167,255,.15)" } : undefined}
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <ChevronDown
          size={15}
          className={`${tokenTextSub} shrink-0`}
          style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-20 mt-1.5 max-h-64 overflow-auto rounded-xl border py-1.5 ${tokenBorder} ${tokenCardBg}`}
          style={{ boxShadow: "0 16px 36px rgba(3,7,18,.15)" }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${active ? "" : tokenText}`}
                style={active ? { color: "#5AA7FF", background: "rgba(90,167,255,.1)" } : undefined}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
