import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { createManualShippingOrderAction } from "@/app/(dashboard)/expedicao/actions";

type NovoPedidoManualPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function NovoPedidoManualPage({
  searchParams,
}: NovoPedidoManualPageProps) {
  const user = await requireRoleAccess(["ADMIN", "TI"]);
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const feedback = resolvedSearchParams?.feedback?.trim() ?? "";

  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title="Novo pedido manual"
        description="Abra pedidos de expedição para operações sem Bling, já com origem comercial padronizada."
        badge="Cadastro manual"
      />

      {feedback === "erro" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Não foi possível criar o pedido manual. Revise os campos obrigatórios.
        </div>
      ) : null}

      <form
        action={createManualShippingOrderAction}
        className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Dados principais</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Depositante">
              <select
                name="depositanteId"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Selecione</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Número do pedido">
              <input
                name="numeroPedido"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Canal de venda">
              <select
                name="salesChannelCode"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Selecione</option>
                {SALES_CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Número da loja / pedido externo">
              <input
                name="numeroLoja"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Nome da loja (se for outro canal)">
              <input
                name="customStoreName"
                placeholder="Ex.: WhatsApp, televendas, parceiro local"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Marketplace">
              <input
                value="Derivado automaticamente a partir do canal"
                disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none"
              />
            </Field>

            <Field label="Data do pedido">
              <input
                type="date"
                name="dataPedido"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Cliente">
              <input
                name="clienteNome"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Documento">
              <input
                name="clienteDocumento"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Cidade">
              <input
                name="clienteCidade"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="UF">
              <input
                name="clienteUf"
                maxLength={2}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase text-slate-700 outline-none"
              />
            </Field>

            <Field label="Previsão de envio">
              <input
                type="date"
                name="previsaoEnvioEm"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Transportadora">
              <input
                name="carrierName"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Serviço de entrega">
              <input
                name="shippingService"
                placeholder="Ex.: SEDEX, Jadlog Package, coleta local"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Código de rastreio">
              <input
                name="trackingCode"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>

            <Field label="Número da nota fiscal">
              <input
                name="invoiceNumber"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              />
            </Field>
          </div>

          <Field label="Observações" className="mt-4">
            <textarea
              name="observacoes"
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
            />
          </Field>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Resumo operacional</h2>
            <div className="mt-4 grid gap-4">
              <Field label="Valor total (R$)">
                <input
                  name="valorTotal"
                  defaultValue="0"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </Field>

              <Field label="Quantidade de itens">
                <input
                  name="quantidadeItens"
                  defaultValue="0"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </Field>

              <Field label="Quantidade de unidades">
                <input
                  name="quantidadeUnidades"
                  defaultValue="0"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Anexos iniciais</h2>
            <div className="mt-4 grid gap-4">
              <Field label="XML da nota fiscal">
                <input
                  type="file"
                  name="invoiceXml"
                  accept=".xml,application/xml,text/xml"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                />
              </Field>

              <Field label="Etiqueta">
                <input
                  type="file"
                  name="shippingLabel"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Como isso será salvo</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Marketplace será derivado automaticamente a partir do canal escolhido.</p>
              <p>Loja ficará com o nome comercial do canal, evitando IDs técnicos na expedição.</p>
              <p>Transportadora, serviço, rastreio e nota fiscal já entram no mesmo formato operacional do pedido integrado.</p>
              <p>XML e etiqueta podem ser anexados já na criação ou depois na tela do pedido.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800">
              <Save className="h-4 w-4" />
              Criar pedido manual
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
