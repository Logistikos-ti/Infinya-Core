"use client";

import { useMemo, useState } from "react";
import { MapPinned, Search } from "lucide-react";

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
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-cyan-300" />
        <p className="text-sm font-semibold text-white">Enderecos cadastrados</p>
      </div>

      <label className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por codigo, descricao ou area"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </label>

      <div className="mt-3 space-y-3">
        {filteredAddresses.length ? (
          filteredAddresses.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{item.codigo}</p>
                  <p className="mt-1 text-sm text-slate-300">{formatArea(item.area)}</p>
                  {item.descricao ? (
                    <p className="mt-1 text-xs text-slate-400">{item.descricao}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    item.ativo ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {item.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
            Nenhum endereco encontrado para essa busca.
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
      return "Expedicao";
    default:
      return value;
  }
}
