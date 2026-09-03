import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";

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

// ---------------------------------------------------------------------------
// Drawer primitives — compartilhado por todos os drawers do financeiro
// (Faturamento, Contas a Pagar, Contratos, Insumos, NFS-e, Boletos) e pelo
// drawer de fatura reaproveitado no portal do depositante.
// ---------------------------------------------------------------------------

export function Drawer({
  onClose,
  eyebrow,
  title,
  subtitle,
  badge,
  icon,
  children,
  footer,
}: {
  onClose: () => void;
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0C1526]">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div className="mb-2.5 flex items-center gap-2">
            {badge}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {eyebrow && (
            <div className={`${FIN_HEADING} mb-1 text-[11px] font-bold uppercase tracking-widest text-violet-500`}>{eyebrow}</div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`${FIN_HEADING} text-lg font-bold text-slate-900 dark:text-zinc-100`}>{title}</div>
              {subtitle && <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{subtitle}</div>}
            </div>
            {icon}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 px-6 py-4 dark:border-white/10">{footer}</div>}
      </aside>
    </div>
  );
}

export function Kv({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 text-sm dark:border-white/5">
      <span className="shrink-0 text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`min-w-0 flex-1 break-words text-right font-semibold text-slate-900 dark:text-zinc-100 ${mono ? `${FIN_MONO} text-xs` : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function MiniKv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`${FIN_MONO} shrink-0 font-semibold text-slate-900 dark:text-zinc-100`}>{value}</span>
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-violet-500">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

// Lançamentos de insumo trazem o nome do insumo na descrição (ex: "Envelope
// de Segurança - 25x35 (1 un)") — mostrado no lugar do depositante no
// extrato, já que o insumo específico é mais relevante ali do que repetir
// quem é o depositante.
export function insumoNomeFromDescricao(descricao: string): string {
  return descricao.replace(/\s*\([^)]*\)\s*$/, "").trim() || descricao;
}
