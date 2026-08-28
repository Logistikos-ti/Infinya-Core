"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnderecoForm } from "./endereco-form";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

export function NovoEnderecoTrigger({ areasDisponiveis }: { areasDisponiveis: string[] }) {
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
          height: "42px",
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
        + Novo endereço
      </button>
      {open ? (
        <EnderecoForm
          onClose={handleClose}
          defaultValues={{
            codigo: "",
            descricao: "",
            area: areasDisponiveis[0] ?? "PICKING",
            unidadePadrao: "",
            rua: "",
            modulo: "",
            nivel: "",
            posicao: "",
            capacidadeMaxima: "",
            capacidadePesoKg: "",
            volumeModo: "",
            alturaCm: "",
            larguraCm: "",
            comprimentoCm: "",
            ativo: true,
          }}
        />
      ) : null}
    </>
  );
}
