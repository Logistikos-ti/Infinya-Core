"use client";

import { useMemo, useState } from "react";
import { mobileColors, hexAlpha, headingFont, MobileIcon } from "@/components/mobile/mobile-kit";
import { Search } from "lucide-react";

type MobileAddressListProps = {
  addresses: Array<{
    id: string;
    codigo: string;
    descricao: string | null;
    area: string;
    ativo: boolean;
  }>;
};

export function MobileAddressList({ addresses }: MobileAddressListProps) {
  const [query, setQuery] = useState("");

  const filteredAddresses = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return addresses;
    }

    return addresses.filter((item) => {
      const haystack = [item.codigo, item.descricao ?? "", formatArea(item.area)]
        .map(normalizeSearch)
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [addresses, query]);

  return (
    <section className="rounded-[24px] p-4" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
      <div className="flex items-center gap-2">
        <MobileIcon name="loc" size={16} strokeWidth={2} />
        <p className="text-sm font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Endereços cadastrados</p>
      </div>

      <label
        className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) }}
      >
        <Search className="h-4 w-4" style={{ color: mobileColors.muted }} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por código, descrição ou área"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: mobileColors.text }}
        />
      </label>

      <div className="mt-3 space-y-3">
        {filteredAddresses.length ? (
          filteredAddresses.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl px-4 py-3"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium" style={{ color: mobileColors.text }}>{item.codigo}</p>
                  <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>{formatArea(item.area)}</p>
                  {item.descricao ? (
                    <p className="mt-1 text-xs" style={{ color: mobileColors.dim }}>{item.descricao}</p>
                  ) : null}
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    background: hexAlpha(item.ativo ? mobileColors.green : "#94A3B8", item.ativo ? 0.16 : 0.1),
                    color: item.ativo ? mobileColors.green : mobileColors.muted,
                  }}
                >
                  {item.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div
            className="rounded-2xl px-4 py-6 text-sm"
            style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
          >
            Nenhum endereço encontrado para essa busca.
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatArea(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Armazenagem";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}
