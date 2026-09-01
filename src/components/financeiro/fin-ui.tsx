import Link from "next/link";
import type { ReactNode } from "react";

// Fonte já carregada em src/app/layout.tsx (Manrope/Space Grotesk), só faltava
// ser usada. Escopo restrito ao módulo financeiro — o resto do app continua
// com a fonte padrão (Inter).
export const FIN_HEADING = "font-[family-name:var(--font-space-grotesk)]";

// Campos técnicos (IDs, CNPJ, valores em R$, datas, quantidades) usam
// JetBrains Mono, não a monoespaçada padrão do app (Geist Mono).
export const FIN_MONO = "font-[family-name:var(--font-jetbrains-mono)]";

export function FinScope({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 font-[family-name:var(--font-manrope)]">
      {children}
    </div>
  );
}

const STATUS_CLASSES: Record<string, string> = {
  PAGO: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  RECEBIDA: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  ATIVO: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  FATURADO: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  PENDENTE: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  ABERTA: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
  FECHADA: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  ENVIADA: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
  VENCIDO: "text-red-600 bg-red-500/10 dark:text-red-400",
  VENCIDA: "text-red-600 bg-red-500/10 dark:text-red-400",
  INATIVO: "text-slate-500 bg-slate-500/10 dark:text-zinc-400",
};

// Os status de fatura (ABERTA/FECHADA/ENVIADA/PAGO) vêm em CAIXA ALTA direto
// do banco. Exibe em texto normal aqui; a cor continua batendo pela chave em
// maiúsculas em STATUS_CLASSES, então isso não muda nenhuma cor.
const STATUS_LABELS: Record<string, string> = {
  PAGO: "Pago",
  RECEBIDA: "Recebida",
  ATIVO: "Ativo",
  FATURADO: "Faturado",
  PENDENTE: "Pendente",
  ABERTA: "Aberta",
  FECHADA: "Fechada",
  ENVIADA: "Enviada",
  VENCIDO: "Vencido",
  VENCIDA: "Vencida",
  INATIVO: "Inativo",
};

export function FinBadge({ status }: { status: string }) {
  const key = status.toUpperCase();
  const classes = STATUS_CLASSES[key] ?? "text-slate-500 bg-slate-500/10 dark:text-zinc-400";
  const label = STATUS_LABELS[key] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold ${classes}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function FinKpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber" | "default";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-500"
      : accent === "amber"
        ? "text-amber-500"
        : "text-slate-900 dark:text-zinc-100";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101B30]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
        {label}
      </div>
      <div className={`${FIN_HEADING} mt-0.5 text-xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

export function FinPrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition hover:brightness-105"
    >
      {children}
    </Link>
  );
}
