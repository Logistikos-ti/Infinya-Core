"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function ProductSearchInput({
  value,
  depositanteId = "",
}: {
  value: string;
  depositanteId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [search, setSearch] = useState(value);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const normalizedSearch = search.trim();
      const params = new URLSearchParams(searchParamsString);
      params.set("view", "produtos");
      if (normalizedSearch) params.set("search", normalizedSearch);
      else params.delete("search");
      if (depositanteId) params.set("depositanteId", depositanteId);

      if ((searchParams.get("search") ?? "") !== normalizedSearch) {
        params.delete("page");
      }

      const nextUrl = `${pathname}?${params.toString()}`;
      const currentUrl = `${pathname}?${searchParamsString}`;
      if (nextUrl !== currentUrl) {
        startTransition(() => router.replace(nextUrl));
      }
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [depositanteId, pathname, router, search, searchParams, searchParamsString]);

  return (
    <label className="flex h-12 w-full items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 text-slate-400 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 sm:w-[320px] dark:border-white/10 dark:bg-[#101b30]">
      <Search className="h-4 w-4 shrink-0" />
      <input
        aria-label="Filtrar produtos"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Filtrar produtos..."
        className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-white"
      />
    </label>
  );
}
