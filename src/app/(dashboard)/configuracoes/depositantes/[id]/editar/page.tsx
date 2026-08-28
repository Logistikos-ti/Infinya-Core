import { notFound } from "next/navigation";
import { DepositanteForm } from "@/components/configuracoes/depositante-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EditarDepositantePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarDepositantePage({
  params,
}: EditarDepositantePageProps) {
  await requireConfigSectionAccess("depositantes");
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
  );
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
