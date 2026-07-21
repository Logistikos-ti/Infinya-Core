import Link from "next/link";
import { redirect } from "next/navigation";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import {
  getEffectiveConfigSections,
  isAdminUser,
  isProductCatalogOnlyUser,
  type ConfigSection,
} from "@/lib/permissions";
import { isTransportadorasSchemaMissing } from "@/lib/transportadoras";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const configModules = [
  {
    href: "/configuracoes/depositantes",
    title: "Depositantes",
    description: "Carteira ativa, contatos, regras operacionais e segregaÃ§Ã£o por cliente.",
  },
  {
    href: "/configuracoes/usuarios",
    title: "UsuÃ¡rios",
    description: "PapÃ©is, acessos, vÃ­nculo por depositante e gestÃ£o de sessÃ£o operacional.",
  },
  {
    href: "/configuracoes/produtos",
    title: "Produtos",
    description: "SKU, EAN/GTIN, categoria, FEFO/FIFO, unidade, lote e validade.",
  },
  {
    href: "/configuracoes/enderecos",
    title: "EndereÃ§os",
    description: "Mapa fÃ­sico de recebimento, pulmÃ£o, picking, bloqueado e expediÃ§Ã£o.",
  },
  {
    href: "/configuracoes/transportadoras",
    title: "Transportadoras",
    description: "CNPJ, modalidades, contato principal e base logÃ­stica para expediÃ§Ã£o e romaneio.",
  },
  {
    href: "/configuracoes/integracoes",
    title: "IntegraÃ§Ãµes",
    description: "Bling V3, OAuth2, webhooks operacionais e conexÃµes externas por depositante.",
  },
] as const;

export default async function ConfiguracoesPage() {
  const currentUser = await requireModuleAccess("configuracoes");
  if (isProductCatalogOnlyUser(currentUser)) {
    redirect("/configuracoes/produtos");
  }

  const allowedSections = getEffectiveConfigSections(currentUser);
  const isFullConfigUser = isAdminUser(currentUser) || allowedSections.length === configModules.length;

  if (!isFullConfigUser && allowedSections.length === 1) {
    redirect(`/configuracoes/${allowedSections[0]}`);
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: depositantes },
    { data: produtos },
    { data: usuarios },
    { data: enderecos },
    transportadorasResult,
  ] = await Promise.all([
    supabase.from("depositantes").select("id, codigo, nome, ativo").order("nome"),
    supabase.from("produtos").select("depositante_id, metodo_retirada, ativo"),
    supabase.from("usuarios").select("depositante_id, ativo"),
    supabase
      .from("enderecos")
      .select("id, codigo, area, capacidade_maxima, ativo")
      .order("codigo")
      .limit(20),
    supabase.from("transportadoras").select("id, ativo"),
  ]);

  const productCountByDepositante = new Map<string, number>();
  const userCountByDepositante = new Map<string, number>();
  const methodCountByDepositante = new Map<string, Array<string | null | undefined>>();

  for (const product of produtos ?? []) {
    if (!product.depositante_id) {
      continue;
    }

    productCountByDepositante.set(
      product.depositante_id,
      (productCountByDepositante.get(product.depositante_id) ?? 0) + 1,
    );

    const currentMethods = methodCountByDepositante.get(product.depositante_id) ?? [];
    currentMethods.push(product.metodo_retirada);
    methodCountByDepositante.set(product.depositante_id, currentMethods);
  }

  for (const user of usuarios ?? []) {
    if (!user.depositante_id) {
      continue;
    }

    userCountByDepositante.set(
      user.depositante_id,
      (userCountByDepositante.get(user.depositante_id) ?? 0) + 1,
    );
  }

  const depositanteCards = (depositantes ?? []).map((depositante) => {
    const preferredMethod = getPreferredMethod(methodCountByDepositante.get(depositante.id) ?? []);

    return {
      id: depositante.id,
      nome: depositante.nome,
      ativo: depositante.ativo,
      skus: productCountByDepositante.get(depositante.id) ?? 0,
      usuarios: userCountByDepositante.get(depositante.id) ?? 0,
      metodo: preferredMethod,
    };
  });

  const activeDepositantes = depositanteCards.filter((item) => item.ativo).length;
  const activeProducts = (produtos ?? []).filter((item) => item.ativo).length;
  const activeUsers = (usuarios ?? []).filter((item) => item.ativo).length;
  const activeAddresses = (enderecos ?? []).filter((item) => item.ativo).length;
  const transportadoras =
    transportadorasResult.error && isTransportadorasSchemaMissing(transportadorasResult.error)
      ? []
      : (transportadorasResult.data ?? []);
  const activeCarriers = transportadoras.filter((item) => item.ativo).length;
  const visibleConfigModules = isFullConfigUser
    ? configModules
    : configModules.filter((module) =>
        allowedSections.includes(module.href.split("/").pop() as ConfigSection),
      );

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="ConfiguraÃ§Ãµes"
        description="Cadastros mestres do WMS: depositantes, usuÃ¡rios, produtos, endereÃ§os, transportadoras e parÃ¢metros operacionais."
        badge="Base operacional"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Depositantes ativos" value={String(activeDepositantes)} />
        <SummaryCard label="Produtos ativos" value={String(activeProducts)} />
        <SummaryCard label="UsuÃ¡rios ativos" value={String(activeUsers)} />
        <SummaryCard label="EndereÃ§os ativos" value={String(activeAddresses)} />
        <SummaryCard label="Transportadoras ativas" value={String(activeCarriers)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="glass-card infinya-border-glow rounded-[24px] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Depositantes base</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Dados reais do ambiente para isolamento multi-tenant e polÃ­ticas de acesso.
              </p>
            </div>
            <span className="rounded-full bg-infinya-gradient px-3 py-1 text-xs font-semibold text-slate-950">
              {activeDepositantes} ativos
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {depositanteCards.length ? (
              depositanteCards.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-950/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.nome}</p>
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                      {item.metodo}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">SKUs</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{item.skus}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">UsuÃ¡rios</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{item.usuarios}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:col-span-2">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        <div className="glass-card infinya-border-glow rounded-[24px] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">PrÃ³ximas aÃ§Ãµes</h2>
          <div className="mt-4 grid gap-3">
            {[
              `Revisar ${activeProducts} produtos jÃ¡ importados no ambiente.`,
              "Padronizar categorias e unidades comerciais por depositante.",
              "Conectar importaÃ§Ã£o em massa com planilhas operacionais reais.",
              "Completar cadastros de usuÃ¡rios, endereÃ§os, transportadoras e regras por cliente.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleConfigModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="glass-card infinya-border-glow rounded-[24px] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]"
          >
            <p className="text-base font-semibold text-slate-950 dark:text-white">{module.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{module.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card infinya-border-glow rounded-[24px] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">EndereÃ§os cadastrados</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">CÃ³digo</th>
                  <th className="pb-3 font-medium">Ãrea</th>
                  <th className="pb-3 font-medium">Capacidade</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {enderecos?.length ? (
                  enderecos.map((address) => (
                    <tr key={address.id} className="border-b border-slate-100 last:border-b-0 dark:border-white/5">
                      <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{address.codigo}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{formatÁrea(address.area)}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{address.capacidade_maxima ?? "-"}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            address.ativo
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                          }`}
                        >
                          {address.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      Nenhum endereÃ§o cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card infinya-border-glow rounded-[24px] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Cobertura atual</h2>
          <div className="mt-4 grid gap-3">
            <StatusRow
              label="Depositantes com SKU cadastrado"
              value={String(depositanteCards.filter((item) => item.skus > 0).length)}
            />
            <StatusRow
              label="Depositantes sem SKU cadastrado"
              value={String(depositanteCards.filter((item) => item.skus === 0).length)}
            />
            <StatusRow
              label="UsuÃ¡rios vinculados a depositantes"
              value={String((usuarios ?? []).filter((item) => item.depositante_id).length)}
            />
            <StatusRow
              label="MÃ©todo predominante no ambiente"
              value={getPreferredMethod((produtos ?? []).map((item) => item.metodo_retirada))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/45">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950/30">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function getPreferredMethod(methods: Array<string | null | undefined>) {
  const counter = new Map<string, number>();

  methods.filter(Boolean).forEach((method) => counter.set(method!, (counter.get(method!) ?? 0) + 1));

  const mostFrequent = [...counter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return mostFrequent ?? "Sem produtos";
}

function formatÁrea(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Armazenagem";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "ExpediÃ§Ã£o";
    default:
      return value;
  }
}


