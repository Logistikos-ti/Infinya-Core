import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { EnderecoForm } from "@/components/configuracoes/endereco-form";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessConfigSection, canAccessModule } from "@/lib/permissions";
import { saveMobileEnderecoAction } from "../actions";

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
    <div className="space-y-4">
      <Link
        href="/m/enderecos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para enderecos
      </Link>

      {feedback === "erro" ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Nao foi possivel salvar o endereco. Revise os campos e tente novamente.
        </div>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
        <div>
          <p className="text-lg font-semibold text-white">Novo endereco</p>
          <p className="mt-1 text-sm text-slate-300">
            Cadastre a nova localizacao do armazem por codigo, area e posicao fisica.
          </p>
        </div>

        <EnderecoForm action={saveMobileEnderecoAction} />
      </section>
    </div>
  );
}
