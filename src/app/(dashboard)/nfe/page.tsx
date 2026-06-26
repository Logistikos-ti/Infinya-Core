import Link from "next/link";
import { Download, Lock, Search } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { NfeOutgoingImportPanel } from "@/components/nfe/nfe-outgoing-import-panel";
import { Button } from "@/components/ui/button";
import { DocumentUploadPanel } from "@/components/storage/document-upload-panel";
import { requireModuleAccess } from "@/lib/auth";
import { listFiscalDocumentsWithDetails } from "@/lib/fiscal-documents";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type NfePageProps = {
  searchParams?: Promise<{
    q?: string;
    fluxo?: string;
    depositante?: string;
    emitente?: string;
    destinatario?: string;
    page?: string;
    perPage?: string;
  }>;
};

export default async function NfePage({ searchParams }: NfePageProps) {
  const user = await requireModuleAccess("nfe");
  const params = searchParams ? await searchParams : undefined;
  const uploadEnabled = canUploadOperationalDocuments(user);
  const q = params?.q?.trim() ?? "";
  const fluxo = params?.fluxo?.trim() ?? "";
  const issuerTerm = params?.emitente?.trim() ?? "";
  const recipientTerm = params?.destinatario?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";
  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, documentosPage] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    listFiscalDocumentsWithDetails(user, {
      q: q || undefined,
      fluxo: fluxo || undefined,
      depositanteId: depositanteFilter || undefined,
      issuerTerm: issuerTerm || undefined,
      recipientTerm: recipientTerm || undefined,
      page,
      perPage,
    }),
  ]);

  const documentos = documentosPage.items;
  const depositanteOptions = filterDepositanteOptionsByUser(
    user,
    (depositantes ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
    })),
  );

  const totalEntrada = documentos.filter((item) => item.flow === "ENTRADA").length;
  const totalSaida = documentos.filter((item) => item.flow === "SAIDA").length;
  const visibleStart = documentosPage.total ? (documentosPage.page - 1) * documentosPage.perPage + 1 : 0;
  const visibleEnd = Math.min(
    (documentosPage.page - 1) * documentosPage.perPage + documentos.length,
    documentosPage.total,
  );
  const baseQuery = {
    q,
    fluxo,
    depositante: depositanteFilter,
    emitente: issuerTerm,
    destinatario: recipientTerm,
    perPage: String(documentosPage.perPage),
  };

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="NF-e"
        description="Consulta fiscal completa de NF-e de entrada e saÃ­da, com XML armazenado, vÃ­nculo operacional e campos tributÃ¡rios por item."
        badge="Fiscal operacional"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Documentos fiscais" value={String(documentosPage.total)} />
        <StatCard label="NF-e de entrada" value={String(totalEntrada)} />
        <StatCard label="NF-e de saÃ­da" value={String(totalSaida)} />
        <StatCard
          label="Com vÃ­nculo operacional"
          value={String(documentos.filter((item) => item.linkedOrderHref).length)}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Consulta fiscal</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pesquise por nota, chave, emitente, destinatÃ¡rio, depositante ou vÃ­nculo operacional.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            {documentosPage.total} registros
          </span>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_0.85fr_1fr_1fr_1fr_auto_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Busca
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="NÃºmero, chave, pedido..."
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Fluxo
              </span>
              <select
                name="fluxo"
                defaultValue={fluxo}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">SaÃ­da</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={depositanteFilter}
                disabled={user.papel === "DEPOSITANTE"}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Emitente
              </span>
              <input
                type="text"
                name="emitente"
                defaultValue={issuerTerm}
                placeholder="RazÃ£o social ou documento"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                DestinatÃ¡rio
              </span>
              <input
                type="text"
                name="destinatario"
                defaultValue={recipientTerm}
                placeholder="RazÃ£o social ou documento"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                PÃ¡gina
              </span>
              <select
                name="perPage"
                defaultValue={String(documentosPage.perPage)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="10">10 / pÃ¡gina</option>
                <option value="20">20 / pÃ¡gina</option>
                <option value="50">50 / pÃ¡gina</option>
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                Filtrar
              </Button>
              <Link
                href="/nfe"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>

        <div className="mt-5 space-y-4">
          {documentos.length ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
                <span>
                  Exibindo {visibleStart}-{visibleEnd} de {documentosPage.total} documento(s)
                </span>
                <div className="flex items-center gap-2">
                  <PageLink
                    disabled={documentosPage.page <= 1}
                    href={`/nfe?${buildQueryString({
                      ...baseQuery,
                      page: String(documentosPage.page - 1),
                    })}`}
                  >
                    Anterior
                  </PageLink>
                  <span className="text-xs font-medium text-slate-500">
                    PÃ¡gina {documentosPage.page} de {documentosPage.totalPages}
                  </span>
                  <PageLink
                    disabled={documentosPage.page >= documentosPage.totalPages}
                    href={`/nfe?${buildQueryString({
                      ...baseQuery,
                      page: String(documentosPage.page + 1),
                    })}`}
                  >
                    PrÃ³xima
                  </PageLink>
                </div>
              </div>

              {documentos.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">NF-e {item.noteNumber}</p>
                          <Badge>{item.flowLabel}</Badge>
                          <Badge>{item.linkedOrderStatus}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.fileName} â€¢ {item.depositante} â€¢ {item.createdAtLabel}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCard label="Chave de acesso" value={item.accessKey ?? "-"} />
                        <InfoCard label="EmissÃ£o" value={item.issuedAtLabel} />
                        <InfoCard label="Valor total" value={item.totalValueLabel} />
                        <InfoCard label="Volumes" value={String(item.volumeCount)} />
                        <InfoCard label="Emitente" value={item.issuerName} />
                        <InfoCard label="Documento emitente" value={item.issuerDocument ?? "-"} />
                        <InfoCard label="DestinatÃ¡rio" value={item.recipientName} />
                        <InfoCard label="Documento destinatÃ¡rio" value={item.recipientDocument ?? "-"} />
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <InfoMini label="Protocolo" value={item.protocolNumber ?? "-"} />
                          <InfoMini
                            label="Status SEFAZ"
                            value={
                              [item.protocolStatusCode, item.protocolStatusLabel]
                                .filter(Boolean)
                                .join(" - ") || "-"
                            }
                          />
                          <InfoMini label="VÃ­nculo operacional" value={item.linkedOrderLabel} />
                          <InfoMini label="Itens no XML" value={String(item.itemCount)} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">Itens fiscais</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-slate-200 text-slate-500">
                              <tr>
                                <th className="px-4 py-3 font-medium">DescriÃ§Ã£o</th>
                                <th className="px-4 py-3 font-medium">CÃ³digo</th>
                                <th className="px-4 py-3 font-medium">EAN</th>
                                <th className="px-4 py-3 font-medium">NCM</th>
                                <th className="px-4 py-3 font-medium">CFOP</th>
                                <th className="px-4 py-3 font-medium">CST/CSOSN</th>
                                <th className="px-4 py-3 font-medium">Quantidade</th>
                                <th className="px-4 py-3 font-medium">ICMS</th>
                                <th className="px-4 py-3 font-medium">IPI</th>
                                <th className="px-4 py-3 font-medium">PIS</th>
                                <th className="px-4 py-3 font-medium">COFINS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.itemsPreview.map((product, index) => (
                                <tr key={`${item.id}-${index}`} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-4 py-3 text-slate-900">{product.descricao}</td>
                                  <td className="px-4 py-3 text-slate-600">{product.codigo ?? "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">{product.ean ?? "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">{product.ncm ?? "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">{product.cfop ?? "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">{product.cstCsosn ?? "-"}</td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {product.quantidade.toLocaleString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{formatCurrency(product.icmsValue)}</td>
                                  <td className="px-4 py-3 text-slate-600">{formatCurrency(product.ipiValue)}</td>
                                  <td className="px-4 py-3 text-slate-600">{formatCurrency(product.pisValue)}</td>
                                  <td className="px-4 py-3 text-slate-600">{formatCurrency(product.cofinsValue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:w-44 xl:flex-col">
                      {item.linkedOrderHref ? (
                        <Link
                          href={item.linkedOrderHref}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Abrir vÃ­nculo
                        </Link>
                      ) : null}
                      <Link
                        href={item.downloadHref}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4" />
                        Baixar XML
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Nenhum documento fiscal encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        {uploadEnabled ? (
          <NfeOutgoingImportPanel
            defaultDepositanteId={depositanteOptions[0]?.id ?? null}
            depositantes={depositanteOptions}
            lockDepositante={user.papel === "DEPOSITANTE"}
          />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-800">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-semibold">ImportaÃ§Ã£o restrita</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Seu perfil atual Ã© <strong>{user.papel}</strong>. A importaÃ§Ã£o de XML fiscal
              de saÃ­da estÃ¡ liberada apenas para Admin, TI e Operador.
            </p>
          </div>
        )}

        {uploadEnabled ? (
          <DocumentUploadPanel
            defaultDepositanteId={depositanteOptions[0]?.id ?? null}
            depositantes={depositanteOptions}
            lockDepositante={user.papel === "DEPOSITANTE"}
          />
        ) : null}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-400">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-white"
    >
      {children}
    </Link>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 20, 50].includes(parsed) ? parsed : 10;
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}
