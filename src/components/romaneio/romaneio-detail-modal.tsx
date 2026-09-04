"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PenLine, Truck, User, X } from "lucide-react";
import type { RomaneioUI } from "./romaneio-types";
import { ROMANEIO_MONO } from "@/lib/romaneio-theme";

type RomaneioDetailModalProps = {
  romaneio: RomaneioUI;
  onClose: () => void;
};

type ConferenceAuditInfo = {
  fotoOperadorUrl: string | null;
  fotoMotoristaUrl: string | null;
  // "assinatura" quando o motorista assinou na tela em vez de ser
  // fotografado -- ausente em romaneios fechados antes dessa opção
  // existir, tratado como "foto" (mesma convenção da página mobile
  // /m/romaneio/[id]/visualizar).
  fotoMotoristaTipo: "foto" | "assinatura";
};

function parseConferenceAuditInfo(json: string | null): ConferenceAuditInfo | null {
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      fotoOperadorUrl: typeof parsed.foto_operador_url === "string" ? parsed.foto_operador_url : null,
      fotoMotoristaUrl: typeof parsed.foto_motorista_url === "string" ? parsed.foto_motorista_url : null,
      fotoMotoristaTipo: parsed.foto_motorista_tipo === "assinatura" ? "assinatura" : "foto",
    };
  } catch {
    return null;
  }
}

function DetailKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--romaneio-text-sub)" }}>
        {label}
      </span>
      <span className="text-[13.5px] font-semibold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function AuditIconButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded-full border transition-colors"
      style={{ borderColor: "rgba(139,92,246,.35)", background: "rgba(139,92,246,.12)", color: "#8B5CF6" }}
    >
      {icon}
    </button>
  );
}

/**
 * Modal de detalhe leve (só leitura), igual ao mockup -- diferente da
 * página /romaneio/[id] (formulário editável + liberar/cancelar + tabela
 * rica de 9 colunas), que não tem equivalente no mockup e continua
 * existindo, só alcançável agora clicando no código do romaneio aqui
 * dentro (senão o "Ver Detalhes" do drawer, que antes navegava pra lá,
 * ficaria sem outra forma de chegar até ela pela lista).
 */
export function RomaneioDetailModal({ romaneio: r, onClose }: RomaneioDetailModalProps) {
  const [previewType, setPreviewType] = useState<"operador" | "motorista" | null>(null);
  const audit = parseConferenceAuditInfo(r.conferenceInfoJson);
  const hasOperadorPhoto = Boolean(r.id && audit?.fotoOperadorUrl);
  const hasMotoristaPhoto = Boolean(r.id && audit?.fotoMotoristaUrl);
  const motoristaIsSignature = audit?.fotoMotoristaTipo === "assinatura";

  return (
    <div
      className="fixed inset-0 z-[59] flex items-center justify-center p-5"
      style={{ background: "rgba(3,7,20,.55)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[640px] max-w-[96vw] max-h-[88vh] flex flex-col rounded-2xl border overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,.4)]"
        style={{ background: "var(--romaneio-drawer-bg)", borderColor: "var(--romaneio-border)" }}
      >
        {/* Header */}
        <div className="px-6 pt-[22px] pb-4 flex items-start gap-3" style={{ borderBottom: "1px solid var(--romaneio-border)" }}>
          <div className="flex-1 min-w-0">
            <span
              className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[11.5px] font-bold mb-2"
              style={{ backgroundColor: r.statusBg, color: r.statusColor }}
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: r.statusDot }} />
              {r.statusLabel}
            </span>
            <div className="text-[19px] font-bold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
              {r.id ? (
                <Link href={`/romaneio/${r.id}`} className="hover:underline">
                  {r.code}
                </Link>
              ) : (
                r.code
              )}
            </div>
            <div className="text-sm mt-0.5" style={{ color: "var(--romaneio-text-sub)" }}>
              {r.carrier}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[30px] h-[30px] flex-shrink-0 flex items-center justify-center rounded-lg border text-[15px]"
            style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-[18px]">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <DetailKeyValue label="Motorista" value={r.driver} />
            <DetailKeyValue label="Placa" value={r.plate} />
            <DetailKeyValue label="Doca" value={r.dock ?? "—"} />
            <DetailKeyValue label="Emissão" value={r.departure} />
            <DetailKeyValue label="Liberação" value={r.releasedAtLabel ?? "—"} />
            <DetailKeyValue label="Peso total" value={`${r.weightKg.toFixed(1)} kg`} />
          </div>

          {(hasOperadorPhoto || hasMotoristaPhoto) && (
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--romaneio-text-sub)" }}>
                Auditoria
              </span>
              {hasOperadorPhoto && (
                <AuditIconButton
                  icon={<User className="h-[15px] w-[15px]" />}
                  label="Ver foto do operador"
                  onClick={() => setPreviewType("operador")}
                />
              )}
              {hasMotoristaPhoto && (
                <AuditIconButton
                  icon={
                    motoristaIsSignature ? (
                      <PenLine className="h-[15px] w-[15px]" />
                    ) : (
                      <Truck className="h-[15px] w-[15px]" />
                    )
                  }
                  label={motoristaIsSignature ? "Ver assinatura do motorista" : "Ver foto do motorista"}
                  onClick={() => setPreviewType("motorista")}
                />
              )}
            </div>
          )}

          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#8B5CF6" }}>
            Pedidos ({r.stops.length} · {r.volumes} vol.)
          </div>
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Pedido", "Cliente", "Volumes", "Peso"].map((h, i) => (
                  <th
                    key={h}
                    className="py-2 px-2.5 text-[10.5px] font-bold tracking-[0.06em] uppercase"
                    style={{
                      textAlign: i >= 2 ? "right" : "left",
                      borderBottom: "1px solid var(--romaneio-border)",
                      background: "var(--romaneio-head-bg)",
                      color: "var(--romaneio-text-sub)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.stops.map((s, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid var(--romaneio-border)" }}>
                  <td className="py-2.5 px-2.5 text-xs" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)" }}>
                    {s.code}
                  </td>
                  <td className="py-2.5 px-2.5 font-semibold" style={{ color: "var(--romaneio-text)" }}>
                    {s.customer}
                  </td>
                  <td className="py-2.5 px-2.5 text-right" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                    {s.vol}
                  </td>
                  <td className="py-2.5 px-2.5 text-right" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                    {s.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-[14px] flex justify-end" style={{ borderTop: "1px solid var(--romaneio-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-[9px] border text-[13px] font-bold"
            style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-input-bg)", color: "var(--romaneio-text)" }}
          >
            Fechar
          </button>
        </div>
      </div>

      {previewType && r.id ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: "rgba(3,7,20,.75)" }}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewType(null);
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden border shadow-[0_30px_60px_rgba(0,0,0,.5)]"
            style={{ background: "var(--romaneio-drawer-bg)", borderColor: "var(--romaneio-border)" }}
          >
            <button
              type="button"
              onClick={() => setPreviewType(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg border z-10"
              style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-drawer-bg)", color: "var(--romaneio-text-sub)" }}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="px-5 pt-4 pb-1 text-[13px] font-bold" style={{ color: "var(--romaneio-text)" }}>
              {previewType === "operador"
                ? "Foto do operador"
                : motoristaIsSignature
                  ? "Assinatura do motorista"
                  : "Foto do motorista"}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- proxy autenticado (/api/romaneio/[id]/foto), next/image não lida com fetch autenticado por cookie de forma simples aqui */}
            <img
              src={`/api/romaneio/${r.id}/foto?type=${previewType}`}
              alt={previewType === "operador" ? "Foto do operador" : "Foto ou assinatura do motorista"}
              className="block max-w-[86vw] max-h-[75vh] object-contain p-5"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
