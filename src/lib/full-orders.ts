import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FullShipmentSummary = {
  id: string;
  code: string;
  marketplace: string;
  status: string;
  invoiceNumber: string;
  collectionAt: string;
  deliveryMode: "COLETA" | "TRANSPORTADORA";
  carrier: string | null;
  recipient: string;
  itemCount: number;
  labelCount: number;
};

export async function listFullShipmentsFromDb(depositanteId: string): Promise<FullShipmentSummary[]> {
  const adminSupabase = createSupabaseAdminClient();
  const { data: shipments, error } = await adminSupabase
    .from("remessas_full")
    .select("id, codigo, marketplace, status, nota_fiscal_numero, coleta_prevista_em, modalidade_envio, transportadora_nome, destinatario_nome")
    .eq("depositante_id", depositanteId)
    .order("coleta_prevista_em", { ascending: true });

  if (error) throw error;
  if (!shipments?.length) return [];

  const shipmentIds = shipments.map((shipment) => shipment.id);
  const [{ data: items }, { data: documents }] = await Promise.all([
    adminSupabase.from("remessas_full_itens").select("remessa_full_id").in("remessa_full_id", shipmentIds),
    adminSupabase
      .from("remessas_full_documentos")
      .select("remessa_full_id, tipo")
      .in("remessa_full_id", shipmentIds)
      .eq("tipo", "ETIQUETA_ITEM"),
  ]);
  const itemCount = new Map<string, number>();
  const labelCount = new Map<string, number>();
  for (const item of items ?? []) itemCount.set(item.remessa_full_id, (itemCount.get(item.remessa_full_id) ?? 0) + 1);
  for (const document of documents ?? []) labelCount.set(document.remessa_full_id, (labelCount.get(document.remessa_full_id) ?? 0) + 1);

  return shipments.map((shipment) => ({
    id: shipment.id,
    code: shipment.codigo,
    marketplace: shipment.marketplace,
    status: shipment.status,
    invoiceNumber: shipment.nota_fiscal_numero,
    collectionAt: shipment.coleta_prevista_em,
    deliveryMode: shipment.modalidade_envio === "TRANSPORTADORA" ? "TRANSPORTADORA" : "COLETA",
    carrier: shipment.transportadora_nome ?? null,
    recipient: shipment.destinatario_nome ?? "Destinatario nao informado",
    itemCount: itemCount.get(shipment.id) ?? 0,
    labelCount: labelCount.get(shipment.id) ?? 0,
  }));
}
