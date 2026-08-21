import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiShippingDocumentAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const auth = await requireApiShippingDocumentAccess();
  if (auth.response) return auth.response;

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: order, error: orderError } = await admin
    .from("pedidos_expedicao")
    .select("id, depositante_id, remessa_full_id")
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) return scopeError;

  if (!order.remessa_full_id) {
    return NextResponse.json({ isFull: false, documents: [] });
  }

  const [{ data: documents, error: documentsError }, { data: items, error: itemsError }] =
    await Promise.all([
      admin
        .from("remessas_full_documentos")
        .select("id, tipo, nome_arquivo, mime_type, tamanho_bytes, created_at, remessa_full_item_id")
        .eq("remessa_full_id", order.remessa_full_id)
        .order("created_at", { ascending: true }),
      admin
        .from("remessas_full_itens")
        .select("id, nome, sku, ean, quantidade")
        .eq("remessa_full_id", order.remessa_full_id),
    ]);

  if (documentsError || itemsError) {
    return NextResponse.json(
      { error: "Não foi possível carregar a documentação Full." },
      { status: 500 },
    );
  }

  const itemById = new Map((items ?? []).map((item) => [item.id, item]));
  return NextResponse.json({
    isFull: true,
    documents: (documents ?? []).map((document) => ({
      id: document.id,
      type: document.tipo,
      fileName: document.nome_arquivo,
      mimeType: document.mime_type,
      sizeBytes: Number(document.tamanho_bytes ?? 0),
      createdAt: document.created_at,
      item: document.remessa_full_item_id
        ? itemById.get(document.remessa_full_item_id) ?? null
        : null,
    })),
  });
}
