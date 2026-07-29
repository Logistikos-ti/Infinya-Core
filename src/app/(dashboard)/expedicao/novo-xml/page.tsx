import Link from "next/link";
import { ArrowLeft, FileCode2, Upload } from "lucide-react";
import { requireRoleAccess } from "@/lib/auth";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createXmlShippingOrderAction } from "../actions";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";

type PageProps = { searchParams?: Promise<{ feedback?: string }> };

export default async function NewXmlShippingOrderPage({ searchParams }: PageProps) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? "";
  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantes } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  const options = filterDepositanteOptionsByUser(user, depositantes ?? []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 dark:bg-[#08111f] dark:text-white sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/expedicao" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:-translate-x-0.5 hover:text-violet-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> Voltar para expedição
        </Link>

        <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <FileCode2 className="h-6 w-6" />
          </div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Pedido manual</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Importar pedido via XML</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Envie o XML de uma NF-e de saída para criar o pedido automaticamente com destinatário, itens, valores, transportadora e documento fiscal.
          </p>
        </header>

        {feedback ? <Feedback feedback={feedback} /> : null}

        <form action={createXmlShippingOrderAction} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <input type="hidden" name="returnPath" value="/expedicao" />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold">Depositante
              <select name="depositanteId" required className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-400 dark:border-white/10 dark:bg-white/5">
                <option value="">Selecione o depositante</option>
                {options.map((option) => <option key={option.id} value={option.id}>{option.nome}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">Canal de venda
              <select name="salesChannelCode" defaultValue="VENDA_DIRETA" required className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition focus:border-violet-400 dark:border-white/10 dark:bg-white/5">
                {SALES_CHANNEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold">Transportadora (opcional)
              <input name="carrierName" placeholder="Ex.: Correios, Shopee Xpress" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
            </label>
            <label className="text-sm font-bold">Serviço de entrega (opcional)
              <input name="shippingService" placeholder="Ex.: PAC, expresso" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium outline-none transition placeholder:text-slate-400 focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
            </label>
          </div>

          <label className="block rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-6 text-sm font-bold text-slate-800 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-slate-100">
            <span className="flex items-center gap-2 text-base"><Upload className="h-5 w-5 text-violet-600" /> XML da NF-e de saída *</span>
            <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">O XML é obrigatório. O sistema fará o vínculo dos itens pelo EAN, código interno, SKU ou nome.</span>
            <input type="file" name="invoiceXml" required accept=".xml,application/xml,text/xml" className="mt-4 block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/5" />
          </label>

          <label className="block text-sm font-bold">Etiqueta de envio (opcional)
            <input type="file" name="shippingLabel" accept=".pdf,.png,.jpg,.jpeg,.zpl,application/pdf,image/png,image/jpeg,text/plain" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5" />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
            <Link href="/expedicao" className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:text-slate-200">Cancelar</Link>
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-px">
              <FileCode2 className="h-4 w-4" /> Criar pedido pelo XML
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Feedback({ feedback }: { feedback: string }) {
  const messages: Record<string, string> = {
    "nf-obrigatoria": "Anexe o XML da NF-e para criar o pedido.",
    "nf-invalida": "Não foi possível ler o XML. Confirme se é uma NF-e válida.",
    "xml-entrada": "Esse XML é de entrada. Para expedição, envie uma NF-e de saída.",
    "xml-produtos-nao-mapeados": "Um ou mais itens do XML não foram encontrados no catálogo do depositante.",
    "nf-duplicada": "Já existe um pedido deste depositante com o mesmo número de NF-e.",
    erro: "Não foi possível criar o pedido. Revise os dados e tente novamente.",
  };
  return <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300">{messages[feedback] ?? messages.erro}</div>;
}
