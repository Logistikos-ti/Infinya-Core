"use client";

import { 
  Hammer, 
  PackagePlus, 
  Truck, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="relative space-y-8 opacity-95">
      {/* HEADER DE DESENVOLVIMENTO */}
      <div className="mb-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 stripes pointer-events-none opacity-50"></div>
        <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl relative z-10">
          <Hammer className="w-6 h-6" />
        </div>
        <div className="relative z-10">
          <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">
            Painel Analítico em Desenvolvimento
          </h2>
          <p className="text-sm text-amber-600/80 dark:text-amber-300/80">
            Esta é uma prévia de como ficarão os indicadores de performance (KPIs) quando a operação começar a gerar volume de dados suficientes. Os números abaixo são exemplos estruturais.
          </p>
        </div>
      </div>

      {/* KPIs Principais */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-2xl glass-card border-l-4 border-l-primary-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Entradas no Mês</p>
            <span className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
              <PackagePlus className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">1.240</h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +12.5%
            </span>
            <span className="text-slate-400">vs mês anterior</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-2xl glass-card border-l-4 border-l-accent-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Saídas no Mês</p>
            <span className="p-2 bg-accent-500/10 text-accent-500 rounded-lg">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">3.850</h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +8.2%
            </span>
            <span className="text-slate-400">vs mês anterior</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-2xl glass-card border-l-4 border-l-emerald-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Acuracidade</p>
            <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">99.8%</h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +0.1%
            </span>
            <span className="text-slate-400">Padrão Ouro</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-2xl glass-card border-l-4 border-l-rose-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Pedidos Atrasados</p>
            <span className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-zinc-100 mt-2">14</h3>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-rose-500 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +2
            </span>
            <span className="text-slate-400">Atenção requerida</span>
          </div>
        </div>
      </section>

      {/* Gráficos e Tabelas */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        
        {/* Gráfico Exemplo: Movimentação */}
        <div className="rounded-2xl glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Volume de Movimentação</h3>
              <p className="text-xs text-slate-500">Inbound vs Outbound nos últimos 7 dias</p>
            </div>
          </div>
          
          <div className="h-64 flex items-end justify-between gap-2 mt-4 px-2">
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "40%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "60%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "35%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "75%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "50%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "45%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "65%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "80%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "80%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "90%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "30%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "40%" }}></div>
            </div>
            <div className="flex gap-1 items-end h-full relative group w-[14%]">
              <div className="w-full bg-primary-500/80 rounded-t-sm" style={{ height: "25%" }}></div>
              <div className="w-full bg-accent-500/80 rounded-t-sm" style={{ height: "35%" }}></div>
            </div>
          </div>
          
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-primary-500"></div> Recebimento
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-accent-500"></div> Expedição
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Ocupação do Armazém */}
          <div className="rounded-2xl glass-card p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Ocupação do Armazém</h3>
            <p className="text-xs text-slate-500 mb-6">Capacidade total utilizada</p>
            
            <div className="relative w-full h-4 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 bg-infinya-gradient rounded-full" style={{ width: "78%" }}></div>
            </div>
            
            <div className="flex justify-between mt-3">
              <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">78%</span>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Posições Livres</span>
                <span className="text-sm font-semibold text-emerald-500">1.245</span>
              </div>
            </div>
          </div>

          {/* Top Depositantes */}
          <div className="rounded-2xl glass-card p-6 flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Volume por Depositante</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">Acme Corp</span>
                  <span className="text-slate-500 dark:text-zinc-400">45%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: "45%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">Tech Solutions</span>
                  <span className="text-slate-500 dark:text-zinc-400">30%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full">
                  <div className="h-full bg-accent-500 rounded-full" style={{ width: "30%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">Global Imports</span>
                  <span className="text-slate-500 dark:text-zinc-400">25%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "25%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela de Últimas Movimentações */}
      <section className="rounded-2xl glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Últimas Movimentações</h3>
            <p className="text-xs text-slate-500">Monitoramento em tempo real do armazém</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium">ID da Transação</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Depositante</th>
                <th className="px-6 py-4 font-medium">Volumes</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800/50 text-slate-700 dark:text-zinc-300">
              <tr className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition cursor-pointer">
                <td className="px-6 py-4 font-medium">TRX-8892</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded bg-accent-500/10 text-accent-500 dark:text-accent-400 text-xs font-bold">Saída</span>
                </td>
                <td className="px-6 py-4">Acme Corp</td>
                <td className="px-6 py-4">45 Caixas</td>
                <td className="px-6 py-4">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xs font-medium">Concluído</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition cursor-pointer">
                <td className="px-6 py-4 font-medium">TRX-8891</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded bg-primary-500/10 text-primary-500 dark:text-primary-400 text-xs font-bold">Entrada</span>
                </td>
                <td className="px-6 py-4">Tech Solutions</td>
                <td className="px-6 py-4">12 Paletes</td>
                <td className="px-6 py-4">
                  <span className="text-amber-500 dark:text-amber-400 text-xs font-medium">Em Conferência</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition cursor-pointer">
                <td className="px-6 py-4 font-medium">TRX-8890</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-500 dark:text-slate-400 text-xs font-bold">Transferência</span>
                </td>
                <td className="px-6 py-4">Global Imports</td>
                <td className="px-6 py-4">2 Paletes</td>
                <td className="px-6 py-4">
                  <span className="text-emerald-500 dark:text-emerald-400 text-xs font-medium">Concluído</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
    </div>
  );
}
