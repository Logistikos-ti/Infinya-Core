import Link from "next/link";
import { redirect } from "next/navigation";
import { EnderecoForm } from "@/components/configuracoes/endereco-form";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessConfigSection, canAccessModule } from "@/lib/permissions";
import { saveMobileEnderecoAction } from "../actions";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";

type MobileNovoEnderecoPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function MobileNovoEnderecoPage({
  searchParams,
}: MobileNovoEnderecoPageProps) {
  const user = await getCurrentUserContext();
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? "";

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "configuracoes") || !canAccessConfigSection(user, "enderecos")) {
    redirect("/m/inicio");
  }

  return (
    <div className="space-y-4 p-[18px]">
      <div className="flex items-center gap-3">
        <Link
          href="/m/enderecos"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[20px]"
          style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.text }}
        >
          &#8249;
        </Link>
        <div className="flex flex-col gap-1">
          <span className="text-[16px] font-extrabold" style={{ color: mobileColors.text, ...headingFont }}>Novo endereço</span>
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>Cadastre a localização por código, área e posição física.</span>
        </div>
      </div>

      {feedback === "erro" ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.1), color: mobileColors.redLight }}
        >
          Não foi possível salvar o endereço. Revise os campos e tente novamente.
        </div>
      ) : null}

      <section className="rounded-[24px] p-4" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
        <EnderecoForm action={saveMobileEnderecoAction} />
      </section>
    </div>
  );
}
