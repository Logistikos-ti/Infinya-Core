import Link from "next/link";
import { Lock } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { NfeOutgoingImportPanel } from "@/components/nfe/nfe-outgoing-import-panel";
import { DocumentUploadPanel } from "@/components/storage/document-upload-panel";
import { requireModuleAccess } from "@/lib/auth";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type RelatedShippingOrder = {
  id?: string;
  codigo?: string | null;
  numero_pedido?: string | null;
  status?: string | null;
  payload_origem?: Record<string, unknown> | null;
} | null;

type RelatedReceivingOrder = {
  id?: string;
  codigo?: string | null;
  nota_fiscal_numero?: string | null;
  status?: string | null;
} | null;

type FiscalDocumentRow = {
  id: string;
  nome_arquivo: string;
  tipo: string;
  created_at: string;
  depositante_id: string;
  pedido_expedicao_id?: string | null;
  pedido_recebimento_id?: string | null;
  depositante: { nome?: string } | null;
  pedido_expedicao?: RelatedShippingOrder;
  pedido_recebimento?: RelatedReceivingOrder;
};

export default async function NfePage() {
  const user = await requireModuleAccess("nfe");
  const uploadEnabled = canUploadOperationalDocuments(user);
  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, { data: documentos }] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase
      .from("documentos_armazenados")
      .select(
        "id, nome_arquivo, tipo, created_at, depositante_id, pedido_expedicao_id, pedido_recebimento_id, depositante:depositantes(nome), pedido_expedicao:pedidos_expedicao(id, codigo, numero_pedido, status, payload_origem), pedido_recebimento:pedidos_recebimento(id, codigo, nota_fiscal_numero, status)",
      )
      .eq("tipo", "NF")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const depositanteOptions = filterDepositanteOptionsByUser(
    user,
    (depositantes ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
    })),
  );

  const visibleDocuments =
    user.depositanteId && user.papel === "DEPOSITANTE"
      ? ((documentos ?? []) as FiscalDocumentRow[]).filter(
          (item) => item.depositante_id === user.depositanteId,
        )
      : (((documentos ?? []) as FiscalDocumentRow[]) ?? []);

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="NF-e"
        description="Caixa fiscal operacional para XMLs de entrada e saída, com storage, vínculo com pedidos e rastreabilidade por depositante."
        badge="Fiscal operacional"
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Inbox fiscal real</h2>
          <p className="mt-1 text-sm text-slate-600">
            XMLs já armazenados no WMS, com vínculo ao recebimento ou à expedição conforme a operação.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Arquivo</th>
                  <th className="pb-3 font-medium">Fluxo</th>
                  <th className="pb-3 font-medium">Vínculo</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.length ? (
                  visibleDocuments.map((item) => {
                    const shippingPayload = isRecord(item.pedido_expedicao?.payload_origem)
                      ? item.pedido_expedicao?.payload_origem
                      : {};
                    const accessKey = readInvoiceAccessKey(shippingPayload);

                    return (
                      <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-3 text-slate-900">
                          <div className="font-medium">{item.nome_arquivo}</div>
                          <div className="text-xs text-slate-500">
                            {item.depositante?.nome ?? "-"} • {formatDateTime(item.created_at)}
                          </div>
                          {accessKey ? (
                            <div className="mt-1 text-xs text-slate-500">Chave: {accessKey}</div>
                          ) : null}
                        </td>
                        <td className="py-3 text-slate-600">{resolveFlowLabel(item)}</td>
                        <td className="py-3 text-slate-600">{resolveLinkLabel(item)}</td>
                        <td className="py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {resolveStatusLabel(item)}
                          </span>
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/api/documentos/${item.id}/download`}
                            className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
                            target="_blank"
                          >
                            Baixar
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Nenhum XML fiscal disponível para o seu depositante.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
              <h2 className="text-lg font-semibold">Importação restrita</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Seu perfil atual é <strong>{user.papel}</strong>. A importação de XML
              fiscal de saída está liberada apenas para Admin, TI e Operador.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Como funciona agora</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>O XML de saída é validado antes do armazenamento operacional.</li>
            <li>O WMS confere se a NF-e é de saída e tenta vincular ao pedido certo.</li>
            <li>Quando encontra o pedido, atualiza número da nota e chave de acesso no fluxo da expedição.</li>
            <li>Pedidos manuais e integrados seguem o mesmo padrão de anexo fiscal.</li>
          </ul>
        </div>

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

function resolveFlowLabel(item: FiscalDocumentRow) {
  if (item.pedido_expedicao_id) {
    return "Saída";
  }

  if (item.pedido_recebimento_id) {
    return "Entrada";
  }

  return "Documento fiscal";
}

function resolveLinkLabel(item: FiscalDocumentRow) {
  if (item.pedido_expedicao) {
    return item.pedido_expedicao.numero_pedido || item.pedido_expedicao.codigo || "Pedido de expedição";
  }

  if (item.pedido_recebimento) {
    return item.pedido_recebimento.codigo || item.pedido_recebimento.nota_fiscal_numero || "Pedido de recebimento";
  }

  return "Sem vínculo automático";
}

function resolveStatusLabel(item: FiscalDocumentRow) {
  if (item.pedido_expedicao?.status) {
    return item.pedido_expedicao.status;
  }

  if (item.pedido_recebimento?.status) {
    return item.pedido_recebimento.status;
  }

  return "Armazenado";
}

function readInvoiceAccessKey(payload: Record<string, unknown>) {
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
  return readString(notaFiscal?.chaveAcesso);
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}
