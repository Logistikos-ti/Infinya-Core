"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function ProductSearchInput({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(value);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ view: "produtos" });
      if (search.trim()) params.set("search", search.trim());
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, search]);

  return (
    <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-400 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 sm:w-[310px] dark:border-white/10 dark:bg-[#101b30]">
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
