import Link from "next/link";
import { ArrowRight, MapPinned, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessConfigSection, canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MobileEnderecosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function MobileEnderecosPage({ searchParams }: MobileEnderecosPageProps) {
  const user = await getCurrentUserContext();
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? "";

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "configuracoes") || !canAccessConfigSection(user, "enderecos")) {
    redirect("/m/inicio");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: enderecos } = await adminSupabase
    .from("enderecos")
    .select("id, codigo, descricao, area, ativo")
    .order("codigo")
    .limit(20);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500 via-fuchsia-600 to-slate-950 p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/90">
          Enderecamento
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Enderecos do armazem</h1>
        <p className="mt-2 text-sm leading-6 text-slate-100/90">
          Cadastre novas localizacoes e acompanhe a estrutura fisica usada no estoque.
        </p>
      </section>

      {feedback === "criado" ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Endereco criado com sucesso.
        </div>
      ) : null}

      <Link
        href="/m/enderecos/novo"
        className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 shadow-lg backdrop-blur transition hover:bg-white/7"
      >
        <div className="inline-flex items-center gap-3">
          <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-white">Novo endereco</p>
            <p className="text-sm text-slate-300">Abrir formulario de cadastro</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
      </Link>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-cyan-300" />
          <p className="text-sm font-semibold text-white">Ultimos enderecos</p>
        </div>

        <div className="mt-3 space-y-3">
          {enderecos?.length ? (
            enderecos.map((item) => (
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
                      item.ativo
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {item.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              Nenhum endereco encontrado.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatArea(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmao";
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
