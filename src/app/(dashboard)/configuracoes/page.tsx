import Link from "next/link";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { isTransportadorasSchemaMissing } from "@/lib/transportadoras";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const configModules = [
  {
    href: "/configuracoes/depositantes",
    title: "Depositantes",
    description: "Carteira ativa, contatos, regras operacionais e segregação por cliente.",
  },
  {
    href: "/configuracoes/usuarios",
    title: "Usuários",
    description: "Papéis, acessos, vínculo por depositante e gestão de sessão operacional.",
  },
  {
    href: "/configuracoes/produtos",
    title: "Produtos",
    description: "SKU, EAN/GTIN, categoria, FEFO/FIFO, unidade, lote e validade.",
  },
  {
    href: "/configuracoes/enderecos",
    title: "Endereços",
    description: "Mapa físico de recebimento, pulmão, picking, bloqueado e expedição.",
  },
  {
    href: "/configuracoes/transportadoras",
    title: "Transportadoras",
    description: "CNPJ, modalidades, contato principal e base logística para expedição e romaneio.",
  },
  {
    href: "/configuracoes/integracoes",
    title: "Integrações",
    description: "Bling V3, OAuth2, webhooks operacionais e conexões externas por depositante.",
  },
] as const;

export default async function ConfiguracoesPage() {
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

  const depositanteCards = (depositantes ?? []).map((depositante) => {
    const relatedProducts = (produtos ?? []).filter((item) => item.depositante_id === depositante.id);
    const relatedUsers = (usuarios ?? []).filter((item) => item.depositante_id === depositante.id);
    const preferredMethod = getPreferredMethod(relatedProducts.map((item) => item.metodo_retirada));

    return {
      id: depositante.id,
      nome: depositante.nome,
      ativo: depositante.ativo,
      skus: relatedProducts.length,
      usuarios: relatedUsers.length,
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

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Configurações"
        description="Cadastros mestres do WMS: depositantes, usuários, produtos, endereços, transportadoras e parâmetros operacionais."
        badge="Base operacional"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Depositantes ativos" value={String(activeDepositantes)} />
        <SummaryCard label="Produtos ativos" value={String(activeProducts)} />
        <SummaryCard label="Usuários ativos" value={String(activeUsers)} />
        <SummaryCard label="Endereços ativos" value={String(activeAddresses)} />
        <SummaryCard label="Transportadoras ativas" value={String(activeCarriers)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Depositantes base</h2>
              <p className="text-sm text-slate-600">
                Dados reais do ambiente para isolamento multi-tenant e políticas de acesso.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {activeDepositantes} ativos
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {depositanteCards.length ? (
              depositanteCards.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.nome}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item.metodo}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">SKUs</p>
                      <p className="mt-1 font-medium text-slate-900">{item.skus}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Usuários</p>
                      <p className="mt-1 font-medium text-slate-900">{item.usuarios}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Próximas ações</h2>
          <div className="mt-4 grid gap-3">
            {[
              `Revisar ${activeProducts} produtos já importados no ambiente.`,
              "Padronizar categorias e unidades comerciais por depositante.",
              "Conectar importação em massa com planilhas operacionais reais.",
              "Completar cadastros de usuários, endereços, transportadoras e regras por cliente.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {configModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
          >
            <p className="text-base font-semibold text-slate-950">{module.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Endereços cadastrados</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Código</th>
                  <th className="pb-3 font-medium">Área</th>
                  <th className="pb-3 font-medium">Capacidade</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {enderecos?.length ? (
                  enderecos.map((address) => (
                    <tr key={address.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 font-medium text-slate-900">{address.codigo}</td>
                      <td className="py-3 text-slate-600">{formatArea(address.area)}</td>
                      <td className="py-3 text-slate-600">{address.capacidade_maxima ?? "-"}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            address.ativo
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {address.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Nenhum endereço cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Cobertura atual</h2>
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
              label="Usuários vinculados a depositantes"
              value={String((usuarios ?? []).filter((item) => item.depositante_id).length)}
            />
            <StatusRow
              label="Método predominante no ambiente"
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function getPreferredMethod(methods: Array<string | null | undefined>) {
  const counter = new Map<string, number>();

  methods.filter(Boolean).forEach((method) => counter.set(method!, (counter.get(method!) ?? 0) + 1));

  const mostFrequent = [...counter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return mostFrequent ?? "Sem produtos";
}

function formatArea(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}
