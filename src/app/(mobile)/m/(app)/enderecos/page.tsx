import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { MobileAddressList } from "@/components/mobile/mobile-address-list";
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
      <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
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
        className="mobile-action-card flex items-center justify-between rounded-[24px] px-4 py-4 transition hover:-translate-y-0.5"
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

      <MobileAddressList addresses={enderecos ?? []} />
    </div>
  );
}
