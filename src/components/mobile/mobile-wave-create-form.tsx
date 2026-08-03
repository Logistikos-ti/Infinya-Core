"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createShippingWaveAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import {
  mobileColors,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobilePrimaryButton,
  MobileIcon,
  MobileButtonSpinner,
} from "@/components/mobile/mobile-kit";

type EligibleOrder = {
  id: string;
  displayNumber: string;
  depositanteId: string;
  depositante: string;
  marketplace: string;
  totalItems: number;
  totalUnits: number;
};

type Depositante = { id: string; nome: string };

type MobileWaveCreateFormProps = {
  orders: EligibleOrder[];
  depositantes: Depositante[];
};

export function MobileWaveCreateForm({ orders, depositantes }: MobileWaveCreateFormProps) {
  const router = useRouter();
  const [selectedDepositante, setSelectedDepositante] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(orders.map((o) => o.id));
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredOrders = useMemo(
    () => (selectedDepositante ? orders.filter((o) => o.depositanteId === selectedDepositante) : orders),
    [orders, selectedDepositante],
  );

  useEffect(() => {
    setSelectedIds(filteredOrders.map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepositante]);

  const allSelected = selectedIds.length === filteredOrders.length && filteredOrders.length > 0;

  const totalUnits = useMemo(
    () => orders.filter((o) => selectedIds.includes(o.id)).reduce((sum, o) => sum + o.totalUnits, 0),
    [orders, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : filteredOrders.map((o) => o.id));
  }

  async function handleCreate() {
    if (!selectedIds.length) return;
    setIsCreating(true);
    setError(null);
    try {
      const waveId = await createShippingWaveAction(selectedIds);
      router.push(`/m/separacao/${waveId}`);
    } catch {
      setError("Não foi possível criar a onda. Tente novamente.");
      setIsCreating(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-[14px] pt-[18px]">
        <MobileBackButton onClick={() => router.push("/m/separacao")} />
        <div className="flex flex-1 flex-col gap-px min-w-0">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Criar onda
          </span>
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>
            Selecione os pedidos para separar juntos
          </span>
        </div>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11.5px] font-extrabold"
          style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.muted }}
        >
          {filteredOrders.length}
        </span>
      </div>

      {depositantes.length > 1 ? (
        <div className="shrink-0 px-[18px] pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedDepositante("")}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition"
              style={
                !selectedDepositante
                  ? { background: hexAlpha(mobileColors.blue, 0.2), color: mobileColors.blueLight }
                  : { border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, color: mobileColors.muted }
              }
            >
              Todos os depositantes
            </button>
            {depositantes.map((dep) => (
              <button
                key={dep.id}
                type="button"
                onClick={() => setSelectedDepositante(dep.id)}
                className="whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition"
                style={
                  selectedDepositante === dep.id
                    ? { background: hexAlpha(mobileColors.blue, 0.2), color: mobileColors.blueLight }
                    : { border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, color: mobileColors.muted }
                }
              >
                {dep.nome}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 px-[18px] pb-3">
        <button
          type="button"
          onClick={toggleAll}
          className="text-[12.5px] font-bold"
          style={{ color: mobileColors.blueLight }}
        >
          {allSelected ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>

      <div className="app-scroll flex flex-1 flex-col gap-[11px] overflow-y-auto px-[18px] pb-[10px]">
        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const selected = selectedIds.includes(order.id);
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => toggle(order.id)}
                className="flex items-center gap-3 rounded-[16px] p-[15px] text-left transition"
                style={{
                  border: `1.5px solid ${selected ? hexAlpha(mobileColors.blue, 0.5) : hexAlpha("#94A3B8", 0.14)}`,
                  background: selected ? hexAlpha(mobileColors.blue, 0.08) : hexAlpha("#94A3B8", 0.045),
                }}
              >
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    border: `2px solid ${selected ? mobileColors.blue : hexAlpha("#94A3B8", 0.3)}`,
                    background: selected ? mobileColors.blue : "transparent",
                  }}
                >
                  {selected ? <MobileIcon name="check" size={13} strokeWidth={3} /> : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className="text-[14.5px] font-extrabold" style={headingFont}>
                    {order.displayNumber}
                  </span>
                  <span
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]"
                    style={{ color: mobileColors.muted }}
                  >
                    {order.depositante || "Sem depositante"} · {order.marketplace || "—"}
                  </span>
                </div>
                <span className="shrink-0 text-[13px] font-bold" style={{ color: mobileColors.text, ...headingFont }}>
                  {order.totalUnits} un
                </span>
              </button>
            );
          })
        ) : (
          <div
            className="rounded-[16px] px-4 py-8 text-center text-sm"
            style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
          >
            {orders.length
              ? "Nenhum pedido elegível para este depositante."
              : "Nenhum pedido elegível para uma nova onda no momento."}
          </div>
        )}
      </div>

      <div
        className="mx-[18px] mb-[18px] shrink-0 rounded-[20px] p-4"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "rgba(10,17,32,0.95)" }}
      >
        <div className="mb-3 flex items-center justify-between text-sm" style={{ color: mobileColors.muted }}>
          <span>{selectedIds.length} pedido(s) selecionado(s)</span>
          <span>{totalUnits} un estimadas</span>
        </div>
        {error ? (
          <p className="mb-3 text-[12.5px] font-medium" style={{ color: mobileColors.redLight }}>
            {error}
          </p>
        ) : null}
        <MobilePrimaryButton onClick={handleCreate} disabled={isCreating || !selectedIds.length}>
          {isCreating ? <MobileButtonSpinner /> : "Criar onda e iniciar"}
        </MobilePrimaryButton>
      </div>
    </div>
  );
}
