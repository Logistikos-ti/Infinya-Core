"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronDown, Minus, Plus, Upload, X, Box } from "lucide-react";
import { createManualShippingOrderAction } from "@/app/(dashboard)/expedicao/actions";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";

type PortalProduct = {
  id: string;
  nome: string;
  sku: string | null;
  codigo_interno: string | null;
  codigo_externo: string | null;
  imagem_principal_url: string | null;
  estoque_disponivel: number;
};

type SelectedProduct = PortalProduct & { quantity: number };

export function PortalNewOrderDrawer({
  depositanteId,
  depositanteName,
  products,
  onClose,
}: {
  depositanteId: string;
  depositanteName: string;
  products: PortalProduct[];
  onClose: () => void;
}) {
  const [channel, setChannel] = useState("MERCADO_LIVRE");
  const [carrier, setCarrier] = useState("Marketplace");
  const [otherCarrier, setOtherCarrier] = useState("");
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return products;
    return products.filter((product) =>
      [product.nome, product.sku, product.codigo_interno, product.codigo_externo]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [products, query]);

  const totalUnits = selected.reduce((sum, product) => sum + product.quantity, 0);
  const selectedIds = new Set(selected.map((product) => product.id));

  function toggleProduct(product: PortalProduct) {
    setSelected((current) =>
      selectedIds.has(product.id)
        ? current.filter((item) => item.id !== product.id)
        : [...current, { ...product, quantity: 1 }],
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Novo pedido">
      <button type="button" aria-label="Fechar novo pedido" onClick={onClose} className="absolute inset-0 cursor-default border-0 bg-slate-900/55 backdrop-blur-sm" />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c1424]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-white to-violet-50 px-6 py-6 dark:border-white/10 dark:from-[#0c1424] dark:to-[#17132b]">
          <div>
            <p className="text-xs font-extrabold tracking-[0.13em] text-slate-500 dark:text-slate-400">NOVO PEDIDO</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Enviar pedido ao CD</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O pedido cai direto na fila de expedição da Infinoos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><X className="h-5 w-5" /></button>
        </header>

        <form action={createManualShippingOrderAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-32 pt-6">
            <input type="hidden" name="returnPath" value="/portal?view=pedidos" />
            <input type="hidden" name="depositanteId" value={depositanteId} />
            <input type="hidden" name="salesChannelCode" value={channel} />
            <input type="hidden" name="dataPedido" value={new Date().toISOString().slice(0, 10)} />
            <input type="hidden" name="quantidadeItens" value={selected.length} />
            <input type="hidden" name="quantidadeUnidades" value={totalUnits} />
            <input type="hidden" name="shippingService" value={carrier} />
            {selected.map((product) => <span key={product.id}><input type="hidden" name="productId[]" value={product.id} /><input type="hidden" name="itemQuantity[]" value={product.quantity} /></span>)}

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Canal de venda</h3>
              <div className="flex flex-wrap gap-2">
                {SALES_CHANNEL_OPTIONS.filter((option) => ["MERCADO_LIVRE", "SHOPEE", "AMAZON", "MAGALU", "SHEIN", "TIKTOK", "KWAI", "SITE_PROPRIO"].includes(option.value)).map((option) => {
                  const active = option.value === channel;
                  const initials: Record<string, string> = { MERCADO_LIVRE: "ML", SHOPEE: "SH", AMAZON: "AM", MAGALU: "MG", SHEIN: "SE", TIKTOK: "TK", KWAI: "KW", SITE_PROPRIO: "SP" };
                  const channelColors: Record<string, string> = { MERCADO_LIVRE: "#2D3277", SHOPEE: "#EE4D2D", AMAZON: "#FF9900", MAGALU: "#0086FF", SHEIN: "#111827", TIKTOK: "#111827", KWAI: "#FF6B35", SITE_PROPRIO: "#8B5CF6" };
                  const channelColor = channelColors[option.value] ?? "#8B5CF6";
                  return <button type="button" key={option.value} onClick={() => setChannel(option.value)} className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-xs font-bold transition hover:-translate-y-px ${active ? "border-violet-500 bg-violet-50 text-slate-950 dark:bg-violet-400/10 dark:text-white" : "border-slate-200 bg-white text-slate-500 hover:border-violet-300 dark:border-white/10 dark:bg-white/5"}`}><span className="grid h-5 w-5 place-items-center rounded-md text-[9px] font-extrabold" style={{ background: `${channelColor}20`, color: channelColor }}>{initials[option.value]}</span>{option.label}</button>;
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Operação</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Depositante<input value={depositanteName} readOnly className="mt-1.5 h-12 w-full rounded-2xl border border-cyan-400 bg-white px-4 text-sm text-slate-900 outline-none dark:bg-white/5 dark:text-white" /></label>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Número do pedido<input required name="numeroPedido" placeholder="Ex.: 18450" className="mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Destinatário</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["clienteNome", "Nome do cliente", "Ex.: Marina Costa", true],
                  ["clienteDocumento", "CPF / CNPJ", "000.000.000-00", false],
                  ["clienteCep", "CEP", "00000-000", false],
                  ["clienteCidade", "Cidade / UF", "São Paulo · SP", false],
                  ["clienteEndereco", "Endereço", "Ex.: Rua das Flores", false],
                  ["clienteNumero", "Número", "Ex.: 125", false],
                  ["clienteTelefone", "Telefone", "(00) 00000-0000", false],
                ].map(([name, label, placeholder, required]) => <label key={String(name)} className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}<input name={String(name)} required={Boolean(required)} placeholder={String(placeholder)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>)}
              </div>
              <input type="hidden" name="clienteUf" value="" />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Itens do pedido</h3><button type="button" onClick={() => setPickerOpen(true)} className="text-xs font-extrabold text-violet-600 transition hover:-translate-y-px dark:text-violet-300">+ Adicionar item</button></div>
              {!selected.length ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/15">Adicione os produtos que deverão ser separados.</div> : <div className="space-y-2">{selected.map((product) => <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-400 to-violet-400 text-white">{product.imagem_principal_url ? <img src={product.imagem_principal_url} alt="" className="h-full w-full object-cover" /> : <Box className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900 dark:text-white">{product.nome}</strong><small className="text-xs text-slate-500">{product.sku || product.codigo_interno || "Sem código"} · {product.estoque_disponivel} em estoque</small></span><button type="button" onClick={() => setSelected((items) => items.map((item) => item.id === product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-white"><Minus className="h-4 w-4" /></button><input aria-label={`Quantidade de ${product.nome}`} value={product.quantity} onChange={(event) => setSelected((items) => items.map((item) => item.id === product.id ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} className="w-8 border-0 bg-transparent text-center text-sm font-extrabold outline-none dark:text-white" /><button type="button" onClick={() => setSelected((items) => items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-white"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setSelected((items) => items.filter((item) => item.id !== product.id))} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10"><X className="h-4 w-4" /></button></div>)}</div>}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Frete / transportadora</h3>
              {carrier === "Outro" ? <input required name="carrierName" value={otherCarrier} onChange={(event) => setOtherCarrier(event.target.value)} placeholder="Digite o nome da transportadora" className="mb-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /> : <input type="hidden" name="carrierName" value={carrier} />}
              <div className="flex flex-wrap gap-2">{["Correios", "Marketplace", "Outro"].map((value) => <button type="button" key={value} onClick={() => setCarrier(value)} className={`rounded-[10px] border px-4 py-2 text-xs font-bold transition hover:-translate-y-px ${carrier === value ? "border-cyan-400 bg-cyan-50 text-slate-900 dark:bg-cyan-400/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>{value}</button>)}</div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Documentos (opcional)</h3>
              <div className="grid gap-3"><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><Upload className="h-5 w-5 text-blue-500" /> Nota fiscal (XML)<input type="file" name="invoiceXml" accept=".xml,.html,.htm,text/xml,application/xml,text/html" className="hidden" /></label><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><Upload className="h-5 w-5 text-violet-500" /> Etiqueta de envio<input type="file" name="shippingLabel" accept=".pdf,.png,.jpg,.jpeg" className="hidden" /></label></div>
            </section>
          </div>
          <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 dark:border-white/10 dark:bg-[#0c1424]/95"><div><span className="block text-xs text-slate-500">Total de itens</span><strong className="text-xl text-slate-950 dark:text-white">{totalUnits}</strong></div><div className="flex gap-3"><button type="button" onClick={onClose} className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-900 transition hover:-translate-y-px hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white">Cancelar</button><button type="submit" disabled={!selected.length} className="h-12 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50">Enviar ao CD</button></div></footer>
        </form>

        {pickerOpen ? <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-[#0c1424]"><div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10"><button type="button" onClick={() => setPickerOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button><strong className="text-lg text-slate-950 dark:text-white">Escolher produtos</strong></div><div className="px-6 pt-5"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou SKU..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></div><div className="flex-1 space-y-2 overflow-y-auto p-6">{filteredProducts.map((product) => { const added = selectedIds.has(product.id); const unavailable = product.estoque_disponivel <= 0; return <button type="button" key={product.id} disabled={unavailable} onClick={() => toggleProduct(product)} className={`flex min-h-[68px] w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-px ${added ? "border-violet-500 bg-violet-50 dark:bg-violet-400/10" : "border-slate-200 dark:border-white/10"} ${unavailable ? "opacity-60" : ""}`}><span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-400 to-violet-400 text-white">{product.imagem_principal_url ? <img src={product.imagem_principal_url} alt="" className="h-full w-full object-cover" /> : <Box className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900 dark:text-white">{product.nome}</strong><small className={`text-xs ${unavailable ? "text-rose-500" : "text-slate-500"}`}>{product.sku || product.codigo_interno || "Sem código"} · {unavailable ? "Sem estoque" : `${product.estoque_disponivel} em estoque`}</small></span><span className={`text-xs font-extrabold ${unavailable ? "text-rose-500" : added ? "text-emerald-500" : "text-violet-600"}`}>{unavailable ? "Indisponível" : added ? <><Check className="mr-1 inline h-4 w-4" />Adicionado</> : "+ Adicionar"}</span></button>; })}</div><div className="border-t border-slate-200 p-6 dark:border-white/10"><button type="button" disabled={!selected.length} onClick={() => setPickerOpen(false)} className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-extrabold text-white disabled:opacity-50">Concluir seleção ({selected.length})</button></div></div> : null}
      </aside>
    </div>
  );
}
