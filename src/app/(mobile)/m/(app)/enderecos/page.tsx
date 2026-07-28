import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { MobileAddressList } from "@/components/mobile/mobile-address-list";
import { canAccessConfigSection, canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mobileColors, hexAlpha, headingFont, mobileGradient, MobileIcon } from "@/components/mobile/mobile-kit-tokens";

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
    <div className="space-y-4 p-[18px]">
      <section
        className="overflow-hidden rounded-[24px] p-5"
        style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.25)}`, background: `linear-gradient(140deg, ${hexAlpha(mobileColors.blue, 0.12)}, ${hexAlpha(mobileColors.violet, 0.12)})` }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.violetLight }}>
          Endereçamento
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Endereços do armazém</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: mobileColors.muted }}>
          Cadastre novas localizações e acompanhe a estrutura física usada no estoque.
        </p>
      </section>

      {feedback === "criado" ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.1), color: mobileColors.green }}
        >
          Endereço criado com sucesso.
        </div>
      ) : null}

      <Link
        href="/m/enderecos/novo"
        className="flex items-center justify-between rounded-[24px] px-4 py-4 transition hover:-translate-y-0.5"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) }}
      >
        <div className="inline-flex items-center gap-3">
          <div className="rounded-2xl p-3" style={{ background: mobileGradient, color: "#fff" }}>
            <MobileIcon name="loc" size={20} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: mobileColors.text }}>Novo endereço</p>
            <p className="text-sm" style={{ color: mobileColors.muted }}>Abrir formulário de cadastro</p>
          </div>
        </div>
        <span style={{ color: mobileColors.muted }}>&#8250;</span>
      </Link>

      <MobileAddressList addresses={enderecos ?? []} />
    </div>
  );
}
