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
        className="novo-endereco-btn inline-flex shrink-0 items-center gap-2"
        style={{
          ...manropeStyle,
          height: "42px",
          padding: "0 20px",
          borderRadius: "999px",
          color: "#FFFFFF",
          fontSize: "14px",
          fontWeight: 800,
          border: "none",
          cursor: "pointer",
        }}
      >
        + Novo endereço
      </button>
      <style jsx>{`
        .novo-endereco-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 220% 100%;
          background-position: 0% 50%;
          box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
          transition:
            background-position 0.6s ease,
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease;
        }
        .novo-endereco-btn:hover {
          background-position: 100% 50%;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
        }
      `}</style>
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
