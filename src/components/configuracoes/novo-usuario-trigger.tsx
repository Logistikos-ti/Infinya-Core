"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UsuarioForm, type UsuarioFormDepositanteOption } from "./usuario-form";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

export function NovoUsuarioTrigger({
  depositantes,
}: {
  depositantes: UsuarioFormDepositanteOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleClose() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 transition-transform hover:-translate-y-px"
        style={{
          ...manropeStyle,
          height: "44px",
          padding: "0 20px",
          borderRadius: "11px",
          background: "linear-gradient(92deg, #3B82F6, #8B5CF6)",
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 800,
          boxShadow: "0 8px 22px rgba(99,102,241,0.32)",
          border: "none",
          cursor: "pointer",
        }}
      >
        + Novo usuário
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F7FB] dark:bg-[#0A1120]" style={manropeStyle}>
          <UsuarioForm depositantes={depositantes} onClose={handleClose} />
        </div>
      ) : null}
    </>
  );
}
