import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Eye, IdCard, PackageCheck, PenLine, Truck, User } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { getRomaneioRecordDetailFromDb } from "@/lib/romaneio-records";
import { getCarrierBrand } from "@/lib/carrier-branding";
import { formatDateTimePtBr } from "@/lib/utils";
import { mobileColors, mobileGradient, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { DownloadRomaneioPdfButton } from "@/components/mobile/download-romaneio-pdf-button";

type VisualizarRomaneioPageProps = {
  params: Promise<{ id: string }>;
};

type ConferenciaInfo = {
  fotoOperadorUrl: string | null;
  fotoMotoristaUrl: string | null;
  /** "assinatura" quando o motorista assinou na tela em vez de ser
   * fotografado -- ausente em romaneios fechados antes dessa opção
   * existir, tratado como "foto" (comportamento de sempre). */
  fotoMotoristaTipo: "foto" | "assinatura";
  conferidoEm: string | null;
  conferidoPor: string | null;
};

function parseConferenciaInfo(notes: string | null): ConferenciaInfo | null {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    return {
      fotoOperadorUrl: typeof parsed.foto_operador_url === "string" ? parsed.foto_operador_url : null,
      fotoMotoristaUrl: typeof parsed.foto_motorista_url === "string" ? parsed.foto_motorista_url : null,
      fotoMotoristaTipo: parsed.foto_motorista_tipo === "assinatura" ? "assinatura" : "foto",
      conferidoEm: typeof parsed.conferido_em === "string" ? parsed.conferido_em : null,
      conferidoPor: typeof parsed.conferido_por === "string" ? parsed.conferido_por : null,
    };
  } catch {
    return null;
  }
}

export default async function VisualizarRomaneioPage({ params }: VisualizarRomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const { id } = await params;

  const romaneio = await getRomaneioRecordDetailFromDb(user, id);
  if (!romaneio) {
    notFound();
  }

  // This is a read-only summary of a finished process -- an ABERTO romaneio
  // has nothing to summarize yet, send those back to the actual flow.
  if (romaneio.status === "ABERTO") {
    redirect(`/m/romaneio/${id}/fechar`);
  }

  const conferencia = parseConferenciaInfo(romaneio.conferenceInfoJson);
  const brand = getCarrierBrand(romaneio.carrierName);
  const statusColor = romaneio.status === "CANCELADO" ? mobileColors.red : mobileColors.green;
  const finalizedAt = romaneio.releasedAt ?? romaneio.canceledAt;
  const cardStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/m/romaneio"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.text,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          &#8249;
        </Link>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Visualizar Romaneio</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>
            {romaneio.code} • {romaneio.carrierName}
          </span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha(statusColor, 0.16),
            color: statusColor,
            flexShrink: 0,
          }}
        >
          {romaneio.statusLabel}
        </span>
      </div>

      <div className="app-scroll space-y-4 px-[18px] pb-[28px]" style={{ flex: 1, overflowY: "auto" }}>
        {/* Resumo do processo */}
        <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-extrabold"
              style={{ backgroundColor: brand.bg, color: brand.color }}
            >
              {brand.init}
            </span>
            <h2 className="text-sm font-bold" style={{ color: mobileColors.text, ...headingFont }}>
              Resumo do fechamento
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <SummaryField label="Transportadora" value={romaneio.carrierName} />
            <SummaryField label="Volumes conferidos" value={`${romaneio.orderCount} pedidos`} />
            <SummaryField label="Motorista" value={romaneio.driverName || "Não informado"} />
            <SummaryField label="Documento" value={romaneio.driverDocument || "Não informado"} />
            <SummaryField label="Veículo" value={romaneio.vehicleModel || "Não informado"} />
            <SummaryField label="Placa" value={romaneio.vehiclePlate || "Não informado"} />
            <SummaryField
              label={romaneio.status === "CANCELADO" ? "Cancelado em" : "Finalizado em"}
              value={finalizedAt ? formatDateTimePtBr(finalizedAt) : "Não informado"}
            />
            <SummaryField label="Conferido por" value={conferencia?.conferidoPor || "Não informado"} />
          </div>
        </div>

        {/* Fotos da auditoria, se registradas */}
        {(conferencia?.fotoOperadorUrl || conferencia?.fotoMotoristaUrl) && (
          <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
            <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: mobileColors.text, ...headingFont }}>
              <IdCard className="h-4 w-4" style={{ color: mobileColors.amber }} />
              Fotos de auditoria
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {conferencia.fotoOperadorUrl && (
                <PhotoCheck
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Operador"
                  url={`/m/romaneio/${romaneio.id}/foto?type=operador`}
                />
              )}
              {conferencia.fotoMotoristaUrl && (
                <PhotoCheck
                  icon={
                    conferencia.fotoMotoristaTipo === "assinatura" ? (
                      <PenLine className="h-3.5 w-3.5" />
                    ) : (
                      <Truck className="h-3.5 w-3.5" />
                    )
                  }
                  label={conferencia.fotoMotoristaTipo === "assinatura" ? "Assinatura do Motorista" : "Motorista / Carga"}
                  hint={conferencia.fotoMotoristaTipo === "assinatura" ? "Toque para ver a assinatura" : "Toque para ver a foto"}
                  url={`/m/romaneio/${romaneio.id}/foto?type=motorista`}
                />
              )}
            </div>
          </div>
        )}

        {/* Todos os pedidos */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold" style={{ color: mobileColors.text, ...headingFont }}>
            Pedidos conferidos ({romaneio.orders.length})
          </h2>

          {romaneio.orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl px-3 py-3"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.12)}`, background: hexAlpha("#000000", 0.15) }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold" style={{ color: mobileColors.text }}>
                      {order.code}
                    </p>
                    <span className="text-xs font-medium" style={{ color: mobileColors.amber }}>
                      {order.invoiceNumber}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs" style={{ color: mobileColors.muted }}>
                    {order.customer}
                  </p>
                  <p className="mt-1 truncate text-[11px]" style={{ color: mobileColors.dim }}>
                    {order.depositante} • {order.destination}
                  </p>
                </div>
                <div className="text-right text-[11px]" style={{ color: mobileColors.muted }}>
                  <p>{order.units} un</p>
                  <p className="mt-1">{order.total}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Ações */}
        <div className="flex flex-col gap-2.5 pt-2">
          <DownloadRomaneioPdfButton
            pdfUrl={`/api/romaneio/${romaneio.id}/pdf`}
            fileName={`romaneio-${romaneio.code.toLowerCase()}.pdf`}
            label="Baixar PDF do Romaneio"
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl px-4 text-center font-extrabold text-white disabled:opacity-70"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          />
          <Link
            href="/m/romaneio"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
            style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.muted }}
          >
            <PackageCheck className="h-4 w-4" />
            Voltar para Romaneios
          </Link>
        </div>
      </div>
    </div>
  );
}

// Tapping the confirmation navigates to /m/romaneio/[id]/foto, a proper
// in-app viewer page with its own dark shell and a back button -- opening
// the raw /api/romaneio/[id]/foto image response directly (the previous
// approach) handed the whole layout over to the browser's own minimal
// image viewer, which rendered the photo tiny and pinned to the top with
// a lot of dead white space, and in a new tab it also repeated the "no
// way back" problem already fixed for the PDF export. A same-tab in-app
// route sidesteps both. The checkmark still communicates "captured" at a
// glance; the small Eye hint is what tells the operator it's tappable.
function PhotoCheck({
  icon,
  label,
  url,
  hint = "Toque para ver a foto",
}: {
  icon: ReactNode;
  label: string;
  url: string;
  hint?: string;
}) {
  return (
    <Link
      href={url}
      className="relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl"
      style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.06) }}
    >
      <Eye className="absolute right-2.5 top-2.5 h-3.5 w-3.5" style={{ color: hexAlpha(mobileColors.green, 0.55) }} />
      <CheckCircle2 className="h-7 w-7" style={{ color: mobileColors.green }} />
      <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: mobileColors.green }}>
        {icon}
        {label}
      </span>
      <span className="text-[9.5px] font-medium" style={{ color: hexAlpha(mobileColors.green, 0.75) }}>
        {hint}
      </span>
    </Link>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.text }}>
        {value}
      </p>
    </div>
  );
}
