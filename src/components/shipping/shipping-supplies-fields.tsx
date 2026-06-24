"use client";

import { useMemo, useState } from "react";
import { Minus, Package2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShippingSupplyItem = {
  kind: string;
  description: string;
  quantity: string;
  unitCost: string;
};

type ShippingSuppliesFieldsProps = {
  initialItems?: ShippingSupplyItem[];
};

const supplyKindOptions = [
  { value: "CAIXA", label: "Caixa" },
  { value: "ENVELOPE", label: "Envelope" },
  { value: "SACO", label: "Saco" },
  { value: "PLASTICO_BOLHA", label: "Plástico bolha" },
  { value: "FITA", label: "Fita" },
  { value: "OUTRO", label: "Outro" },
] as const;

const emptySupply: ShippingSupplyItem = {
  kind: "CAIXA",
  description: "",
  quantity: "1",
  unitCost: "0",
};

export function ShippingSuppliesFields({
  initialItems = [],
}: ShippingSuppliesFieldsProps) {
  const [items, setItems] = useState<ShippingSupplyItem[]>(
    initialItems.length ? initialItems : [emptySupply],
  );

  const totalCost = useMemo(
    () =>
      items.reduce((accumulator, item) => {
        const quantity = normalizeNumber(item.quantity);
        const unitCost = normalizeNumber(item.unitCost);
        return accumulator + quantity * unitCost;
      }, 0),
    [items],
  );

  function updateItem(index: number, patch: Partial<ShippingSupplyItem>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((current) => [...current, emptySupply]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? [emptySupply] : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Insumos do pedido</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Registre envelopes, caixas e outros materiais usados nesta expedição, com custo por pedido.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          Custo total: {formatCurrency(totalCost)}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {items.map((item, index) => {
          const lineTotal = normalizeNumber(item.quantity) * normalizeNumber(item.unitCost);

          return (
            <div
              key={`shipping-supply-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr_0.65fr_0.8fr_auto]">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tipo
                  </span>
                  <select
                    name="supplyKind[]"
                    value={item.kind}
                    onChange={(event) => updateItem(index, { kind: event.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  >
                    {supplyKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Descrição
                  </span>
                  <input
                    name="supplyDescription[]"
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                    placeholder="Ex.: Caixa parda P, envelope bolha 25x35"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Quantidade
                  </span>
                  <input
                    name="supplyQuantity[]"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: event.target.value })}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Custo unitário
                  </span>
                  <input
                    name="supplyUnitCost[]"
                    value={item.unitCost}
                    onChange={(event) => updateItem(index, { unitCost: event.target.value })}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <div className="min-w-28 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Total
                    </p>
                    <p className="mt-1 font-medium text-slate-900">{formatCurrency(lineTotal)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeItem(index)}
                    aria-label={`Remover insumo ${index + 1}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Adicionar insumo
        </Button>
      </div>
    </div>
  );
}

function normalizeNumber(value: string) {
  const numericValue = Number(value.replace(",", "."));
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
