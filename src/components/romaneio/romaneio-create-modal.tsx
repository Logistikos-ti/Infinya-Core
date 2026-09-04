"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { createRomaneioRecordAction } from "@/app/(dashboard)/romaneio/actions";
import type { RomaneioRecordListItem, RomaneioRecordOrder, RomaneioTransportadoraOption } from "@/lib/romaneio-records";
import { ROMANEIO_GRADIENT, ROMANEIO_MONO } from "@/lib/romaneio-theme";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

// Mesmas 3 docas físicas usadas hoje no recebimento (RECEIVING_DOCK_OPTIONS
// em receiving-constants.ts) -- mas mantida como constante própria aqui:
// aquela é nomeada/documentada como específica do fluxo de recebimento, e
// acoplar os dois sentidos (entrada/saída) por um import só porque os
// valores coincidem hoje é uma armadilha se um dia deixarem de coincidir.
const DOCK_OPTIONS = ["DOCA-01", "DOCA-02", "DOCA-03"];

type RomaneioCreateModalProps = {
  records: RomaneioRecordListItem[];
  transportadoraOptions: RomaneioTransportadoraOption[];
  orderWeights: Record<string, number>;
  onClose: () => void;
};

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      className="flex flex-col gap-1.5 text-[11px] font-bold uppercase"
      style={{ color: "var(--romaneio-text-sub)", letterSpacing: "0.05em" }}
    >
      {label}
      {children}
    </label>
  );
}

function GerarRomaneioSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Gerando romaneio" : "Gerar romaneio"}
      className="h-10 px-5 rounded-[9px] border-none text-sm font-extrabold"
      style={{ background: ROMANEIO_GRADIENT, color: "#fff", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.82 : 1 }}
    >
      {pending ? <MobileButtonSpinner size={22} color="#FFFFFF" /> : "Gerar romaneio"}
    </button>
  );
}

export function RomaneioCreateModal({ records, transportadoraOptions, orderWeights, onClose }: RomaneioCreateModalProps) {
  const [transportadoraId, setTransportadoraId] = useState("");
  const [transportadoraNomeLivre, setTransportadoraNomeLivre] = useState("");
  const [doca, setDoca] = useState(DOCK_OPTIONS[0]);
  const [motoristaNome, setMotoristaNome] = useState("");
  const [veiculoPlaca, setVeiculoPlaca] = useState("");
  const [coletaPrevista, setColetaPrevista] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<RomaneioRecordOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/romaneio/pedidos-disponiveis")
      .then((response) => response.json())
      .then((body: { orders?: RomaneioRecordOrder[]; error?: string }) => {
        if (!alive) return;
        if (body.orders) setOrders(body.orders);
        else setLoadError(body.error ?? "Não foi possível carregar os pedidos disponíveis.");
      })
      .catch(() => alive && setLoadError("Falha de comunicação ao carregar os pedidos disponíveis."));
    return () => {
      alive = false;
    };
  }, []);

  const carrierName = useMemo(() => {
    if (transportadoraId) {
      return transportadoraOptions.find((item) => item.id === transportadoraId)?.nome ?? "";
    }
    return transportadoraNomeLivre.trim();
  }, [transportadoraId, transportadoraNomeLivre, transportadoraOptions]);

  const openRomaneioForCarrier = useMemo(() => {
    if (!carrierName) return null;
    const normalized = carrierName.trim().toLocaleLowerCase("pt-BR");
    return (
      records.find(
        (record) => record.status === "ABERTO" && record.carrierName.trim().toLocaleLowerCase("pt-BR") === normalized,
      ) ?? null
    );
  }, [carrierName, records]);

  function toggleOrder(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!carrierName) {
      event.preventDefault();
      toast.warning("Informe a transportadora.");
      return;
    }
    if (!selectedIds.size) {
      event.preventDefault();
      toast.warning("Selecione ao menos um pedido.");
    }
  }

  const selectedVol = orders?.filter((o) => selectedIds.has(o.id)).reduce((sum, o) => sum + o.unitsRaw, 0) ?? 0;
  const selectedWeight =
    orders?.filter((o) => selectedIds.has(o.id)).reduce((sum, o) => sum + (orderWeights[o.id] ?? 0), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-5" style={{ background: "rgba(3,7,20,.5)", backdropFilter: "blur(5px)" }} onClick={onClose}>
      <form
        action={createRomaneioRecordAction}
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-[600px] max-w-[96vw] max-h-[88vh] flex flex-col rounded-2xl border shadow-[0_30px_60px_rgba(0,0,0,.35)]"
        style={{ background: "var(--romaneio-drawer-bg)", borderColor: "var(--romaneio-border)" }}
      >
        {Array.from(selectedIds).map((id) => (
          <input key={id} type="hidden" name="pedidoIds" value={id} />
        ))}
        <input type="hidden" name="transportadoraId" value={transportadoraId} />
        <input type="hidden" name="transportadoraNome" value={carrierName} />
        <input type="hidden" name="motoristaNome" value={motoristaNome} />
        <input type="hidden" name="veiculoPlaca" value={veiculoPlaca} />
        <input type="hidden" name="doca" value={doca} />
        <input type="hidden" name="coletaPrevista" value={coletaPrevista} />
        <input type="hidden" name="observacoes" value={observacoes} />

        <div className="px-6 pt-5 pb-3 border-b" style={{ borderColor: "var(--romaneio-border)" }}>
          <div className="font-[family-name:var(--font-space-grotesk)] text-[10px] font-bold tracking-[0.28em] mb-1" style={{ color: "#8B5CF6" }}>
            ROMANEIO
          </div>
          <h3 className="m-0 font-[family-name:var(--font-space-grotesk)] text-xl font-bold" style={{ color: "var(--romaneio-text)" }}>
            Gerar romaneio
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-[18px] flex flex-col gap-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <FieldLabel label="Transportadora">
              <select
                value={transportadoraId}
                onChange={(event) => {
                  setTransportadoraId(event.target.value);
                  if (event.target.value) setTransportadoraNomeLivre("");
                }}
                className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium"
                style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
              >
                <option value="">Digitar nome livre…</option>
                {transportadoraOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
              {!transportadoraId ? (
                <input
                  type="text"
                  value={transportadoraNomeLivre}
                  onChange={(event) => setTransportadoraNomeLivre(event.target.value)}
                  placeholder="Nome da transportadora"
                  className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium normal-case"
                  style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
                />
              ) : null}
            </FieldLabel>
            <FieldLabel label="Doca">
              <select
                value={doca}
                onChange={(event) => setDoca(event.target.value)}
                className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium"
                style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
              >
                {DOCK_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Motorista">
              <input
                type="text"
                value={motoristaNome}
                onChange={(event) => setMotoristaNome(event.target.value)}
                placeholder="Nome completo"
                className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium normal-case"
                style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
              />
            </FieldLabel>
            <FieldLabel label="Placa">
              <input
                type="text"
                value={veiculoPlaca}
                onChange={(event) => setVeiculoPlaca(event.target.value)}
                placeholder="ABC-1234"
                className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium normal-case"
                style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)", fontFamily: ROMANEIO_MONO }}
              />
            </FieldLabel>
            <FieldLabel label="Coleta prevista">
              <input
                type="text"
                value={coletaPrevista}
                onChange={(event) => setColetaPrevista(event.target.value)}
                placeholder="03/09/2026 09:00"
                className="w-full h-[42px] rounded-[9px] border px-3 text-[13.5px] font-medium normal-case"
                style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)", fontFamily: ROMANEIO_MONO }}
              />
            </FieldLabel>
          </div>

          <FieldLabel label="Observações">
            <textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Opcional: instruções pro motorista, prioridade, corredor..."
              rows={3}
              className="w-full rounded-[9px] border px-3 py-2.5 text-[13.5px] font-medium normal-case"
              style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
            />
          </FieldLabel>

          {openRomaneioForCarrier ? (
            <div
              className="flex items-start gap-2.5 rounded-[10px] border p-3 text-[12.5px]"
              style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.1)", color: "#B45309" }}
            >
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Já existe um romaneio aberto para {carrierName} ({openRomaneioForCarrier.code}). Pedidos com DANFE
                bipada no chão vão continuar indo automaticamente para ele, não para este novo romaneio.
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--romaneio-text-sub)", letterSpacing: "0.05em" }}>
              Pedidos a incluir ({selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"} · {selectedVol} vol. ·{" "}
              {selectedWeight.toFixed(1)} kg)
            </span>
            <div
              className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto rounded-[9px] border p-2"
              style={{ borderColor: "var(--romaneio-border)" }}
            >
              {!orders ? (
                <p className="text-sm p-2" style={{ color: "var(--romaneio-text-sub)" }}>
                  {loadError ?? "Carregando pedidos disponíveis..."}
                </p>
              ) : orders.length === 0 ? (
                <p className="text-sm p-2" style={{ color: "var(--romaneio-text-sub)" }}>
                  Nenhum pedido pronto para romaneio no momento.
                </p>
              ) : (
                orders.map((order) => {
                  const checked = selectedIds.has(order.id);
                  return (
                    <label
                      key={order.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer"
                      style={{ background: checked ? "rgba(139,92,246,.10)" : "transparent" }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleOrder(order.id)} className="h-4 w-4 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: "var(--romaneio-text)" }}>
                          {order.customer}
                        </div>
                        <div className="text-[11px]" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)" }}>
                          {order.code} · {order.carrierName} · {order.units} vol. · {(orderWeights[order.id] ?? 0).toFixed(1)} kg
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 px-6 pt-[14px] pb-5 border-t justify-end" style={{ borderColor: "var(--romaneio-border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-[9px] border text-sm font-bold"
            style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
          >
            Cancelar
          </button>
          <GerarRomaneioSubmitButton />
        </div>
      </form>
    </div>
  );
}
