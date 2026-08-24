"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  Eye,
  Gift,
  LoaderCircle,
  MapPin,
  Package,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function QuarantineViewClient({
  quarantine,
  canDecide,
}: {
  quarantine: any[];
  canDecide: boolean;
}) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"DOAR" | "DESCARTAR" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const activeItems = quarantine.filter((item) => item.status === "EM_QUARENTENA");
  const discardedItems = quarantine.filter((item) => item.status === "DESCARTADO");
  const activeUnits = activeItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  function getTipoLabel(tipo: string) {
    if (tipo === "AVARIA") return "Avaria";
    if (tipo === "RECEBIMENTO") return "Recebimento";
    return "Outro";
  }

  async function decideQuarantine(decision: "DOAR" | "DESCARTAR") {
    if (!selectedItem || pendingAction) return;

    setFeedback(null);
    setPendingAction(decision);

    try {
      const response = await fetch(`/api/estoque/quarentena/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: decision === "DOAR" ? "decide_donate" : "decide_discard",
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível registrar a decisão.");
      }

      setSelectedItem((current: any) =>
        current
          ? {
              ...current,
              depositanteDecision: decision,
              depositanteDecisionLabel: decision === "DOAR" ? "Doar / liberar" : "Descartar",
              statusLabel: "Aguardando confirmação",
            }
          : current,
      );
      setFeedback({ type: "success", message: payload.message || "Decisão registrada com sucesso." });
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
            Quarentena
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Produtos retidos por avaria, divergência ou análise operacional antes de voltarem ao estoque disponível.
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-500/5">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">Em quarentena</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-3xl font-bold text-amber-900 dark:text-amber-100">{activeItems.length}</span>
            <span className="mb-1 text-sm text-amber-600 dark:text-amber-500">{activeUnits.toLocaleString("pt-BR")} un retidas</span>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/30 dark:bg-rose-500/5">
          <div className="text-sm font-bold text-rose-700 dark:text-rose-400">Descartados</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-3xl font-bold text-rose-900 dark:text-rose-100">{discardedItems.length}</span>
            <span className="mb-1 text-sm text-rose-600 dark:text-rose-500">Baixa definitiva</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
              Itens retidos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhe o que está indisponível para separação e expedição.
            </p>
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {quarantine.length} registro(s)
          </span>
        </div>
        {quarantine.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="text-[12px] uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
                <tr>
                  {[
                    "Produto",
                    "Tipo",
                    "Quantidade",
                    "Status",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-5 py-3 font-bold dark:border-white/10 dark:bg-white/5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quarantine.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-white/10"
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.sku || "SKU não informado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {getTipoLabel(item.tipo)}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-950 dark:text-white">
                      {item.quantityLabel} un
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${item.status === "EM_QUARENTENA" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : item.status === "DESCARTADO" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(null);
                          setSelectedItem(item);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 hover:shadow-sm dark:border-white/10 dark:text-slate-400 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                        title="Visualizar quarentena"
                        aria-label={`Visualizar quarentena de ${item.productName}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum item em quarentena no momento.
          </div>
        )}
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-950/50 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <aside
            className="flex h-full w-full max-w-[480px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0b1528]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
                  {selectedItem.imageUrl ? (
                    <img
                      src={selectedItem.imageUrl}
                      alt={selectedItem.productName}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-500">
                    Detalhes da quarentena
                  </p>
                  <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold leading-tight text-slate-950 dark:text-white">
                    {selectedItem.productName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedItem.sku || "SKU não informado"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:text-slate-400 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                aria-label="Fechar detalhes"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {feedback ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  }`}
                >
                  {feedback.message}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-3">
                <DetailCard label="Tipo" value={getTipoLabel(selectedItem.tipo)} />
                <DetailCard label="Quantidade" value={`${selectedItem.quantityLabel} un`} />
                <DetailCard label="Status" value={selectedItem.statusLabel} />
              </div>

              <DrawerSection icon={AlertTriangle} title="Motivo da retenção">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selectedItem.reason || "Motivo não informado."}
                </p>
              </DrawerSection>

              <DrawerSection icon={MapPin} title="Localização">
                <div className="grid grid-cols-2 gap-3">
                  <DetailCard label="Endereço" value={selectedItem.endereco || "Não informado"} />
                  <DetailCard label="Área" value={selectedItem.area || "Não informada"} />
                </div>
              </DrawerSection>

              <DrawerSection icon={UserRound} title="Registro operacional">
                <div className="grid grid-cols-2 gap-3">
                  <DetailCard label="Registrado por" value={selectedItem.createdBy || "Sistema"} />
                  <DetailCard label="Data do registro" value={selectedItem.createdAtLabel || "Não informada"} />
                </div>
              </DrawerSection>

              {(selectedItem.resolutionNotes || selectedItem.resolvedAtLabel || selectedItem.resolvedBy) && (
                <DrawerSection icon={CalendarClock} title="Resolução">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <DetailCard label="Resolvido por" value={selectedItem.resolvedBy || "Não informado"} />
                      <DetailCard label="Data da resolução" value={selectedItem.resolvedAtLabel || "Não informada"} />
                    </div>
                    {selectedItem.resolutionNotes ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {selectedItem.resolutionNotes}
                      </div>
                    ) : null}
                  </div>
                </DrawerSection>
              )}

              <DrawerSection icon={Camera} title="Foto da avaria">
                {selectedItem.fotoUrl ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(selectedItem.fotoUrl)}
                    className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-white/10 dark:bg-slate-950 dark:hover:border-violet-500/40"
                  >
                    <img
                      src={selectedItem.fotoUrl}
                      alt={`Foto da avaria de ${selectedItem.productName}`}
                      className="max-h-[360px] w-full object-contain"
                    />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/75 px-3 py-2 text-xs font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <Eye className="h-3.5 w-3.5" /> Ampliar foto
                    </span>
                  </button>
                ) : (
                  <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center dark:border-white/15 dark:bg-white/[0.03]">
                    <div>
                      <Camera className="mx-auto h-6 w-6 text-slate-400" />
                      <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Nenhuma foto de avaria registrada.
                      </p>
                    </div>
                  </div>
                )}
              </DrawerSection>

              {selectedItem.status === "EM_QUARENTENA" && !selectedItem.isSystemHold ? (
                <DrawerSection icon={ShieldAlert} title="Decisão do depositante">
                  <div className="space-y-3">
                    {selectedItem.depositanteDecision ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                          Decisão registrada
                        </p>
                        <p className="mt-1 text-sm font-bold text-amber-900 dark:text-amber-100">
                          {selectedItem.depositanteDecisionLabel}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                          Aguardando a confirmação física do operador logístico.
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                        Defina o destino do item. O saldo continuará bloqueado até o operador confirmar a execução.
                      </p>
                    )}

                    {canDecide ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => decideQuarantine("DOAR")}
                          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                            selectedItem.depositanteDecision === "DOAR"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          }`}
                        >
                          {pendingAction === "DOAR" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                          Doar / liberar
                        </button>
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => decideQuarantine("DESCARTAR")}
                          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                            selectedItem.depositanteDecision === "DESCARTAR"
                              ? "border-rose-500 bg-rose-500 text-white"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                          }`}
                        >
                          {pendingAction === "DESCARTAR" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Descartar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </DrawerSection>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-4 py-3">
              <h3 className="font-bold text-slate-900 dark:text-white">Foto da Ocorrência</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 p-4 flex justify-center">
              <img src={selectedPhoto} alt="Avaria" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function DrawerSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-bold text-slate-950 dark:text-white">{title}</h4>
      </div>
      {children}
    </section>
  );
}
