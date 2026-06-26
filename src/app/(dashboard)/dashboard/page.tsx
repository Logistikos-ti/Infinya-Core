"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Hammer,
  PackagePlus,
  Truck,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="relative space-y-8 opacity-95">
      <div className="glass-card infinya-border-glow relative overflow-hidden rounded-[28px] p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_32%)]" />
        <div className="absolute inset-0 stripes pointer-events-none opacity-20" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="rounded-2xl bg-infinya-gradient p-3 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.22)]">
            <Hammer className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Painel Analítico em Desenvolvimento
            </h2>
            <p className="mt-1 max-w-4xl text-sm text-slate-600 dark:text-slate-300">
              Esta é uma prévia de como ficarão os indicadores de performance (KPIs)
              quando a operação começar a gerar volume de dados suficientes. Os
              números abaixo são exemplos estruturais.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card infinya-border-glow group relative overflow-hidden rounded-[24px] border-l-4 border-l-cyan-400 p-5 shadow-sm transition-all hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Entradas no Mês
            </p>
            <span className="rounded-lg bg-infinya-gradient p-2 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
              <PackagePlus className="h-4 w-4" />
            </span>
          </div>
          <h3 className="mt-2 text-3xl font-bold text-slate-800 dark:text-zinc-100">
            1.240
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center text-emerald-500 dark:text-emerald-400">
              <ArrowUpRight className="mr-1 h-3 w-3" /> +12.5%
            </span>
            <span className="text-slate-400">vs mês anterior</span>
          </div>
        </div>

        <div className="glass-card infinya-border-glow group relative overflow-hidden rounded-[24px] border-l-4 border-l-fuchsia-400 p-5 shadow-sm transition-all hover:border-fuchsia-300/30 hover:shadow-[0_18px_50px_rgba(217,70,239,0.10)]">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Saídas no Mês
            </p>
            <span className="rounded-lg bg-fuchsia-500/12 p-2 text-fuchsia-500 dark:text-fuchsia-300">
              <Truck className="h-4 w-4" />
            </span>
          </div>
          <h3 className="mt-2 text-3xl font-bold text-slate-800 dark:text-zinc-100">
            3.850
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center text-emerald-500 dark:text-emerald-400">
              <ArrowUpRight className="mr-1 h-3 w-3" /> +8.2%
            </span>
            <span className="text-slate-400">vs mês anterior</span>
          </div>
        </div>

        <div className="glass-card infinya-border-glow group relative overflow-hidden rounded-[24px] border-l-4 border-l-emerald-400 p-5 shadow-sm transition-all hover:border-emerald-300/30 hover:shadow-[0_18px_50px_rgba(16,185,129,0.10)]">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Acuracidade
            </p>
            <span className="rounded-lg bg-emerald-500/12 p-2 text-emerald-500 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <h3 className="mt-2 text-3xl font-bold text-slate-800 dark:text-zinc-100">
            99.8%
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center text-emerald-500 dark:text-emerald-400">
              <ArrowUpRight className="mr-1 h-3 w-3" /> +0.1%
            </span>
            <span className="text-slate-400">Padrão Ouro</span>
          </div>
        </div>

        <div className="glass-card infinya-border-glow group relative overflow-hidden rounded-[24px] border-l-4 border-l-rose-400 p-5 shadow-sm transition-all hover:border-rose-300/30 hover:shadow-[0_18px_50px_rgba(244,63,94,0.10)]">
          <div className="mb-2 flex items-start justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Pedidos Atrasados
            </p>
            <span className="rounded-lg bg-rose-500/12 p-2 text-rose-500 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <h3 className="mt-2 text-3xl font-bold text-slate-800 dark:text-zinc-100">
            14
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="flex items-center text-rose-500">
              <ArrowUpRight className="mr-1 h-3 w-3" /> +2
            </span>
            <span className="text-slate-400">Atenção requerida</span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass-card infinya-border-glow rounded-[28px] p-6 transition-all hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Volume de Movimentação
              </h3>
              <p className="text-xs text-slate-500">
                Inbound vs Outbound nos últimos 7 dias
              </p>
            </div>
          </div>

          <div className="mt-4 flex h-64 items-end justify-between gap-2 px-2">
            {[
              ["40%", "60%"],
              ["35%", "75%"],
              ["50%", "45%"],
              ["65%", "80%"],
              ["80%", "90%"],
              ["30%", "40%"],
              ["25%", "35%"],
            ].map(([inbound, outbound], index) => (
              <div key={`${inbound}-${outbound}-${index}`} className="relative flex h-full w-[14%] items-end gap-1">
                <div className="w-full rounded-t-sm bg-cyan-400/80" style={{ height: inbound }} />
                <div className="w-full rounded-t-sm bg-fuchsia-400/80" style={{ height: outbound }} />
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <div className="h-3 w-3 rounded-full bg-cyan-400" /> Recebimento
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <div className="h-3 w-3 rounded-full bg-fuchsia-400" /> Expedição
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass-card infinya-border-glow rounded-[28px] p-6 transition-all hover:border-fuchsia-300/30 hover:shadow-[0_18px_50px_rgba(217,70,239,0.08)]">
            <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
              Ocupação do Armazém
            </h3>
            <p className="mb-6 text-xs text-slate-500">Capacidade total utilizada</p>

            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div className="absolute inset-y-0 left-0 rounded-full bg-infinya-gradient" style={{ width: "78%" }} />
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">78%</span>
              <div className="text-right">
                <span className="block text-xs text-slate-500">Posições Livres</span>
                <span className="text-sm font-semibold text-emerald-500">1.245</span>
              </div>
            </div>
          </div>

          <div className="glass-card infinya-border-glow flex-1 rounded-[28px] p-6 transition-all hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]">
            <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
              Volume por Depositante
            </h3>
            <div className="space-y-4">
              {[
                ["Acme Corp", "45%", "bg-cyan-400", "45%"],
                ["Tech Solutions", "30%", "bg-fuchsia-400", "30%"],
                ["Global Imports", "25%", "bg-emerald-500", "25%"],
              ].map(([name, percent, color, width]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{name}</span>
                    <span className="text-slate-500 dark:text-zinc-400">{percent}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-800">
                    <div className={`h-full rounded-full ${color}`} style={{ width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card infinya-border-glow overflow-hidden rounded-[28px] transition-all hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]">
        <div className="flex items-center justify-between border-b border-slate-200/70 p-6 dark:border-zinc-800/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Últimas Movimentações
            </h3>
            <p className="text-xs text-slate-500">
              Monitoramento em tempo real do armazém
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium">ID da Transação</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Depositante</th>
                <th className="px-6 py-4 font-medium">Volumes</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 dark:divide-zinc-800/50 dark:text-zinc-300">
              <tr className="cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                <td className="px-6 py-4 font-medium">TRX-8892</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-fuchsia-500/10 px-2 py-1 text-xs font-bold text-fuchsia-500 dark:text-fuchsia-300">
                    Saída
                  </span>
                </td>
                <td className="px-6 py-4">Acme Corp</td>
                <td className="px-6 py-4">45 Caixas</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">
                    Concluído
                  </span>
                </td>
              </tr>
              <tr className="cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                <td className="px-6 py-4 font-medium">TRX-8891</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                    Entrada
                  </span>
                </td>
                <td className="px-6 py-4">Tech Solutions</td>
                <td className="px-6 py-4">12 Paletes</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium text-amber-500 dark:text-amber-400">
                    Em Conferência
                  </span>
                </td>
              </tr>
              <tr className="cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                <td className="px-6 py-4 font-medium">TRX-8890</td>
                <td className="px-6 py-4">
                  <span className="rounded bg-slate-500/10 px-2 py-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                    Transferência
                  </span>
                </td>
                <td className="px-6 py-4">Global Imports</td>
                <td className="px-6 py-4">2 Paletes</td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">
                    Concluído
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
