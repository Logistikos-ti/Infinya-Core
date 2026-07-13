"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";

type AddressFiltersFormProps = {
  area: string;
  areas: FancySelectOption[];
};

export function AddressFiltersForm({ area, areas }: AddressFiltersFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [areaValue, setAreaValue] = useState(area);
  const hasFilters = useMemo(() => Boolean(areaValue), [areaValue]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (areaValue) {
      params.set("area", areaValue);
    } else {
      params.delete("area");
    }

    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function handleClear() {
    setAreaValue("");
    router.push(pathname);
  }

  return (
    <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
      <div className="min-w-[240px] flex-1 md:max-w-xs">
        <FancySelectInput
          label="Área"
          name="area"
          value={areaValue}
          onChange={setAreaValue}
          options={areas}
        />
      </div>
      <Button type="submit" variant="outline" size="sm">
        Filtrar
      </Button>
      {hasFilters ? (
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Limpar
        </button>
      ) : null}
    </form>
  );
}
