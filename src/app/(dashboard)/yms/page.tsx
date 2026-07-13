import Link from "next/link";
import { ArrowRight, Clock, MapPin, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";

export default function YmsDashboardPage() {
  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="YMS - Controle de Docas"
        description="Acompanhamento em tempo real das docas e agendamentos de carga e descarga para transportadoras."
        badge="Novo Módulo"
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Truck}
          label="Veículos no Pátio"
          value="0"
          help="Aguardando liberação"
        />
        <StatCard
          icon={MapPin}
          label="Docas Ocupadas"
          value="0 / 4"
          help="Disponibilidade atual"
        />
        <StatCard
          icon={Clock}
          label="Agendamentos Hoje"
          value="0"
          help="Previstos para carga/descarga"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Próximos Agendamentos
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Transportadoras previstas para as próximas horas.
              </p>
            </div>
            <Link
              href="/yms/agendamentos"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
            >
              Abrir agenda
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            <EmptyBox message="Nenhum agendamento previsto no momento." />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Status das Docas
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Visão rápida das docas em operação agora.
              </p>
            </div>
            <Link
              href="/yms/docas"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
            >
              Painel de Docas
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            <EmptyBox message="Todas as docas estão livres." />
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
      {message}
    </div>
  );
}
