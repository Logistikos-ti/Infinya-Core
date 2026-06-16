import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { DepositanteForm } from "@/components/configuracoes/depositante-form";
import { Button } from "@/components/ui/button";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDepositanteAction } from "@/app/(dashboard)/configuracoes/depositantes/actions";

type EditarDepositantePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarDepositantePage({
  params,
}: EditarDepositantePageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: depositante } = await supabase
    .from("depositantes")
    .select("id, codigo, nome, cnpj, ativo, logo_url, observacoes, configuracoes")
    .eq("id", id)
    .maybeSingle();

  if (!depositante) {
    notFound();
  }

  const configuracoes = parseDepositanteConfiguracoes(
    depositante.configuracoes
      ? JSON.stringify(depositante.configuracoes)
      : depositante.observacoes,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes/depositantes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para depositantes
      </Link>

      <ModulePageHeader
        title={`Editar ${depositante.nome}`}
        description="Atualize informações cadastrais, contatos, regras operacionais e status do depositante."
        badge="Cadastro"
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DepositanteForm
          defaultValues={{
            id: depositante.id,
            codigo: depositante.codigo,
            nome: depositante.nome,
            razaoSocial: configuracoes.razaoSocial || depositante.nome,
            cnpj: formatCnpj(depositante.cnpj),
            ativo: depositante.ativo,
            logoUrl: depositante.logo_url,
            logoStoragePath: configuracoes.logoStoragePath,
            enderecoFiscalCep: configuracoes.enderecoFiscal.cep,
            enderecoFiscalLogradouro: configuracoes.enderecoFiscal.logradouro,
            enderecoFiscalNumero: configuracoes.enderecoFiscal.numero,
            enderecoFiscalComplemento: configuracoes.enderecoFiscal.complemento,
            enderecoFiscalBairro: configuracoes.enderecoFiscal.bairro,
            enderecoFiscalCidade: configuracoes.enderecoFiscal.cidade,
            enderecoFiscalUf: configuracoes.enderecoFiscal.uf,
            emailsContato: configuracoes.emailsContato,
            telefonesContato: configuracoes.telefonesContato,
            observacoes: configuracoes.observacoes,
            metodoRetiradaPadrao: configuracoes.metodoRetiradaPadrao,
            exigeLotePadrao: configuracoes.exigeLotePadrao,
            exigeValidadePadrao: configuracoes.exigeValidadePadrao,
            permiteFracionamento: configuracoes.permiteFracionamento,
            diasMinimosValidade: configuracoes.diasMinimosValidade,
            prefixoRecebimento: configuracoes.prefixoRecebimento,
          }}
        />

        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Zona de exclusão</h2>
          <p className="mt-2 text-sm text-slate-600">
            A exclusão é permitida apenas quando o depositante ainda não possui usuários,
            produtos, estoque ou pedidos vinculados.
          </p>
          <form action={deleteDepositanteAction} className="mt-4">
            <input type="hidden" name="id" value={depositante.id} />
            <Button
              type="submit"
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Excluir depositante
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
