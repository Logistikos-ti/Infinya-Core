import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isOwnOperationMode } from "@/lib/brand";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { DepositanteRowActions } from "@/components/configuracoes/depositante-row-actions";
import { NovoDepositanteTrigger } from "@/components/configuracoes/novo-depositante-trigger";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

const avatarPalette: Array<[string, string]> = [
  ["#3B82F6", "rgba(59,130,246,0.6)"],
  ["#8B5CF6", "rgba(139,92,246,0.6)"],
  ["#EC4899", "rgba(236,72,153,0.6)"],
  ["#10B981", "rgba(16,185,129,0.6)"],
  ["#F59E0B", "rgba(245,158,11,0.6)"],
  ["#06B6D4", "rgba(6,182,212,0.6)"],
  ["#A855F7", "rgba(168,85,247,0.6)"],
];

type ConfiguracoesDepositantesPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ConfiguracoesDepositantesPage({
  searchParams,
}: ConfiguracoesDepositantesPageProps) {
  if (isOwnOperationMode()) {
    redirect("/configuracoes");
  }
  await requireConfigSectionAccess("depositantes");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const supabase = await createSupabaseServerClient();

  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, codigo, nome, cnpj, ativo, logo_url, observacoes, configuracoes")
    .order("nome");

  const rows = (depositantes ?? []).map((item, index) => {
    const configuracoes = parseDepositanteConfiguracoes(
      item.configuracoes ? JSON.stringify(item.configuracoes) : item.observacoes,
    );
    const [color, colorFaded] = avatarPalette[index % avatarPalette.length];
    const cnpjDisplay = formatCnpj(item.cnpj as string);

    return {
      id: item.id as string,
      nome: item.nome as string,
      razaoSocial: configuracoes.razaoSocial || (item.nome as string),
      cnpj: cnpjDisplay,
      ativo: item.ativo as boolean,
      logoUrl: item.logo_url as string | null,
      initials: getInitials(item.nome as string),
      avatarBg: `linear-gradient(135deg, ${color}, ${colorFaded})`,
      editDefaults: {
        id: item.id as string,
        codigo: item.codigo as string,
        nome: item.nome as string,
        razaoSocial: configuracoes.razaoSocial || (item.nome as string),
        cnpj: cnpjDisplay,
        ativo: item.ativo as boolean,
        logoUrl: (item.logo_url as string | null) ?? null,
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
      },
    };
  });

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}>
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>Depositantes</h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Depositantes</span>
          </div>
        </div>
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[22px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>Clientes que armazenam produtos no CD.</p>
          <NovoDepositanteTrigger />
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback === "criado" || feedback === "salvo" || feedback === "excluido"
                ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-[#10B981]"
                : "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] text-[#F59E0B]"
            }`}
          >
            {feedback === "criado"
              ? "Depositante criado com sucesso."
              : feedback === "salvo"
                ? "Depositante atualizado com sucesso."
                : feedback === "excluido"
                  ? "Depositante excluído com sucesso."
                  : feedback === "vinculos"
                    ? "Não foi possível excluir este depositante porque já existem vínculos operacionais. Nesse caso, use desativar."
                    : "Não foi possível concluir a operação solicitada."}
          </div>
        ) : null}

        <div className={`overflow-x-auto rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          <div style={{ minWidth: "720px" }}>
            <div
              className={`flex items-center border-b ${tokenBorder} ${tokenInputBg}`}
              style={{ gap: "16px", padding: "12px 22px" }}
            >
              <span
                className={tokenTextSub}
                style={{
                  flex: "2.4 1 0%",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  textAlign: "left",
                }}
              >
                Nome fantasia / Razão social
              </span>
              <span
                className={tokenTextSub}
                style={{
                  flex: "1.4 1 0%",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  textAlign: "left",
                }}
              >
                CNPJ
              </span>
              <span
                className={tokenTextSub}
                style={{
                  flex: "2 1 0%",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  textAlign: "right",
                }}
              >
                Status / Ações
              </span>
            </div>

            {rows.length ? (
              rows.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center border-b last:border-b-0 ${tokenBorder}`}
                  style={{ gap: "16px", padding: "15px 22px" }}
                >
                  <div
                    className="flex items-center"
                    style={{ flex: "2.4 1 0%", gap: "13px", minWidth: "220px" }}
                  >
                    {row.logoUrl ? (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          flexShrink: 0,
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <Image
                          src={row.logoUrl}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <span
                        style={{
                          width: "40px",
                          height: "40px",
                          flexShrink: 0,
                          borderRadius: "999px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "13.5px",
                          color: "#FFFFFF",
                          background: row.avatarBg,
                        }}
                      >
                        {row.initials}
                      </span>
                    )}
                    <div
                      className="flex flex-col"
                      style={{ minWidth: 0, gap: "2px" }}
                    >
                      <span
                        className={tokenText}
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.nome}
                      </span>
                      <span
                        className={tokenTextSub}
                        style={{
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.razaoSocial}
                      </span>
                    </div>
                  </div>
                  <span
                    className={tokenText}
                    style={{ flex: "1.4 1 0%", fontSize: "13.5px", fontWeight: 600 }}
                  >
                    {row.cnpj}
                  </span>
                  <div
                    className="flex items-center justify-end"
                    style={{ flex: "2 1 0%" }}
                  >
                    <DepositanteRowActions
                      id={row.id}
                      nome={row.nome}
                      ativo={row.ativo}
                      editDefaults={row.editDefaults}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className={`px-[22px] py-10 text-center text-sm ${tokenTextSub}`}>
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
