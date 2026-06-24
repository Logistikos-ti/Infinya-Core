"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";
import {
  buildManualCommercialPayload,
  getSalesChannelLabel,
  type SalesChannelCode,
} from "@/lib/sales-channels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDocumentMimeTypes, maxDocumentFileSizeBytes } from "@/lib/storage";

type ShippingSupplyPayloadItem = {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

export async function updateShippingOrderAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/expedicao?feedback=erro");
  }

  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  const numeroPedido = String(formData.get("numeroPedido") ?? "").trim();
  const numeroLoja = String(formData.get("numeroLoja") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const previsaoEnvioEm = String(formData.get("previsaoEnvioEm") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const salesChannelCode = String(formData.get("salesChannelCode") ?? "").trim() as SalesChannelCode;
  const customStoreName = String(formData.get("customStoreName") ?? "").trim();
  const mercadoLivreOrderId = String(formData.get("mercadoLivreOrderId") ?? "").trim();
  const mercadoLivreShipmentId = String(formData.get("mercadoLivreShipmentId") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();

  const allowedStatuses = new Set([
    "NOVO",
    "EM_SEPARACAO",
    "SEPARADO",
    "EM_CONFERENCIA",
    "CONFERIDO",
    "PRONTO_ROMANEIO",
    "EXPEDIDO",
    "CANCELADO",
  ]);

  if (!allowedStatuses.has(status)) {
    redirect(`/expedicao/${id}/editar?feedback=status-invalido`);
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: currentOrder } = await adminSupabase
    .from("pedidos_expedicao")
    .select("origem, payload_origem")
    .eq("id", id)
    .maybeSingle();

  const currentPayload =
    currentOrder?.payload_origem && typeof currentOrder.payload_origem === "object" && !Array.isArray(currentOrder.payload_origem)
      ? (currentOrder.payload_origem as Record<string, unknown>)
      : {};
  const isManualOrder = currentOrder?.origem === "MANUAL";
  const currentComercial = isRecord(currentPayload.comercial) ? currentPayload.comercial : {};
  const currentTransporte = isRecord(currentPayload.transporte) ? currentPayload.transporte : {};
  const currentContato = isRecord(currentTransporte.contato) ? currentTransporte.contato : {};
  const supplies = extractShippingSupplies(formData);
  const nextPayload = {
    ...currentPayload,
    comercial:
      isManualOrder || salesChannelCode
        ? buildManualCommercialPayload({
            salesChannelCode: salesChannelCode || "VENDA_DIRETA",
            customStoreName,
          })
        : currentComercial,
    mercadoLivre: {
      ...(isRecord(currentPayload.mercadoLivre) ? currentPayload.mercadoLivre : {}),
      orderId: mercadoLivreOrderId || null,
      shipmentId: mercadoLivreShipmentId || null,
    },
    notaFiscal: {
      ...(isRecord(currentPayload.notaFiscal) ? currentPayload.notaFiscal : {}),
      numero: invoiceNumber || null,
    },
    transporte: {
      ...currentTransporte,
      contato: {
        ...currentContato,
        nome: carrierName || null,
      },
      volumes: [
        {
          servico: shippingService || null,
          codigoRastreamento: trackingCode || null,
        },
      ],
    },
    insumos: {
      itens: supplies,
      custoTotal: supplies.reduce((accumulator, item) => accumulator + item.totalCost, 0),
    },
  };

  const { error } = await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status,
      numero_pedido: numeroPedido || null,
      numero_loja:
        isManualOrder && salesChannelCode === "OUTRO" && customStoreName
          ? customStoreName
          : numeroLoja || null,
      canal:
        isManualOrder || salesChannelCode
          ? getSalesChannelLabel(salesChannelCode || "VENDA_DIRETA") ?? "Venda direta"
          : undefined,
      cliente_nome: clienteNome || null,
      cliente_documento: clienteDocumento || null,
      cliente_cidade: clienteCidade || null,
      cliente_uf: clienteUf || null,
      previsao_envio_em: previsaoEnvioEm || null,
      observacoes: observacoes || null,
      payload_origem: nextPayload,
    })
    .eq("id", id);

  if (error) {
    redirect(`/expedicao/${id}/editar?feedback=erro`);
  }

  revalidatePath("/expedicao");
  revalidatePath(`/expedicao/${id}`);
  revalidatePath(`/expedicao/${id}/editar`);
  redirect(`/expedicao/${id}?feedback=salvo`);
}

export async function createManualShippingOrderAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const numeroPedido = String(formData.get("numeroPedido") ?? "").trim();
  const numeroLoja = String(formData.get("numeroLoja") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const previsaoEnvioEm = String(formData.get("previsaoEnvioEm") ?? "").trim();
  const dataPedido = String(formData.get("dataPedido") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const salesChannelCode = String(formData.get("salesChannelCode") ?? "").trim() as SalesChannelCode;
  const customStoreName = String(formData.get("customStoreName") ?? "").trim();
  const mercadoLivreOrderId = String(formData.get("mercadoLivreOrderId") ?? "").trim();
  const mercadoLivreShipmentId = String(formData.get("mercadoLivreShipmentId") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const total = Number(String(formData.get("valorTotal") ?? "0").replace(",", "."));
  const itemCount = Number(String(formData.get("quantidadeItens") ?? "0").replace(",", "."));
  const unitCount = Number(String(formData.get("quantidadeUnidades") ?? "0").replace(",", "."));
  const supplies = extractShippingSupplies(formData);
  const xmlFile = formData.get("invoiceXml");
  const labelFile = formData.get("shippingLabel");

  if (!depositanteId || !numeroPedido || !clienteNome || !salesChannelCode) {
    redirect("/expedicao/novo?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const channelLabel = getSalesChannelLabel(salesChannelCode) ?? "Venda direta";
  const comercial = buildManualCommercialPayload({
    salesChannelCode,
    customStoreName,
  });

  const payloadOrigem = {
    manual: true,
    criadoPor: {
      userId: user.id,
      nome: user.nome,
      em: new Date().toISOString(),
    },
    comercial,
    mercadoLivre: {
      orderId: mercadoLivreOrderId || null,
      shipmentId: mercadoLivreShipmentId || null,
    },
    notaFiscal: {
      numero: invoiceNumber || null,
    },
    transporte: {
      contato: {
        nome: carrierName || null,
      },
      volumes: [
        {
          servico: shippingService || null,
          codigoRastreamento: trackingCode || null,
        },
      ],
    },
    insumos: {
      itens: supplies,
      custoTotal: supplies.reduce((accumulator, item) => accumulator + item.totalCost, 0),
    },
  };

  const headerPayload = {
    depositante_id: depositanteId,
    codigo: buildManualShippingOrderCode(),
    referencia_externa: `MANUAL-${randomUUID()}`,
    origem: "MANUAL",
    canal: channelLabel,
    status: "NOVO",
    status_origem: "MANUAL",
    numero_pedido: numeroPedido,
    numero_loja:
      salesChannelCode === "OUTRO" && customStoreName ? customStoreName : numeroLoja || null,
    cliente_nome: clienteNome,
    cliente_documento: clienteDocumento || null,
    cliente_cidade: clienteCidade || null,
    cliente_uf: clienteUf || null,
    valor_total: Number.isFinite(total) ? total : 0,
    quantidade_itens: Number.isFinite(itemCount) ? itemCount : 0,
    quantidade_unidades: Number.isFinite(unitCount) ? unitCount : 0,
    data_pedido: dataPedido ? `${dataPedido}T00:00:00` : new Date().toISOString(),
    previsao_envio_em: previsaoEnvioEm || null,
    sincronizado_em: new Date().toISOString(),
    payload_origem: payloadOrigem,
    observacoes: observacoes || null,
  };

  try {
    const { data: createdOrder, error } = await adminSupabase
      .from("pedidos_expedicao")
      .insert(headerPayload)
      .select("id")
      .single();

    if (error || !createdOrder) {
      redirect("/expedicao/novo?feedback=erro");
    }

    const parsedXmlFile = readOptionalUpload(xmlFile);
    const parsedLabelFile = readOptionalUpload(labelFile);

    if (parsedXmlFile) {
      await storeOperationalDocumentFromBuffer({
        adminSupabase,
        depositanteId,
        tipo: "NF",
        fileName: parsedXmlFile.name,
        mimeType: parsedXmlFile.type,
        bytes: Buffer.from(await parsedXmlFile.arrayBuffer()),
        pedidoExpedicaoId: createdOrder.id,
        enviadoPor: user.id,
      });
    }

    if (parsedLabelFile) {
      await storeOperationalDocumentFromBuffer({
        adminSupabase,
        depositanteId,
        tipo: "ETIQUETA",
        fileName: parsedLabelFile.name,
        mimeType: parsedLabelFile.type,
        bytes: Buffer.from(await parsedLabelFile.arrayBuffer()),
        pedidoExpedicaoId: createdOrder.id,
        enviadoPor: user.id,
      });
    }

    revalidatePath("/expedicao");
    revalidatePath(`/expedicao/${createdOrder.id}`);
    redirect(`/expedicao/${createdOrder.id}?feedback=salvo`);
  } catch {
    redirect("/expedicao/novo?feedback=erro");
  }
}

function buildManualShippingOrderCode() {
  return `MAN-${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

function readOptionalUpload(value: FormDataEntryValue | null) {
  if (typeof File === "undefined" || !(value instanceof File) || !value.name || value.size <= 0) {
    return null;
  }

  if (value.size > maxDocumentFileSizeBytes) {
    throw new Error("O arquivo excede o limite de 10 MB.");
  }

  if (!allowedDocumentMimeTypes.includes(value.type as (typeof allowedDocumentMimeTypes)[number])) {
    throw new Error("Formato de arquivo não suportado.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractShippingSupplies(formData: FormData): ShippingSupplyPayloadItem[] {
  const kinds = formData.getAll("supplyKind[]").map((item) => String(item ?? "").trim().toUpperCase());
  const descriptions = formData.getAll("supplyDescription[]").map((item) => String(item ?? "").trim());
  const quantities = formData.getAll("supplyQuantity[]").map((item) => normalizeDecimalInput(String(item ?? "")));
  const unitCosts = formData.getAll("supplyUnitCost[]").map((item) => normalizeDecimalInput(String(item ?? "")));
  const parsedItems: Array<ShippingSupplyPayloadItem | null> = [];

  for (const [index, kind] of kinds.entries()) {
    const quantity = quantities[index] ?? 0;
    const unitCost = unitCosts[index] ?? 0;
    const description = descriptions[index] ?? "";
    const totalCost = quantity * unitCost;

    if (!kind || quantity <= 0 || unitCost < 0) {
      parsedItems.push(null);
      continue;
    }

    if (!description && unitCost === 0) {
      parsedItems.push(null);
      continue;
    }

    parsedItems.push({
      id: randomUUID(),
      kind,
      label: mapSupplyKindLabel(kind),
      description: description || null,
      quantity,
      unitCost,
      totalCost,
    });
  }

  return parsedItems.filter((item): item is ShippingSupplyPayloadItem => item !== null);
}

function normalizeDecimalInput(value: string) {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function mapSupplyKindLabel(kind: string) {
  switch (kind) {
    case "CAIXA":
      return "Caixa";
    case "ENVELOPE":
      return "Envelope";
    case "SACO":
      return "Saco";
    case "PLASTICO_BOLHA":
      return "Plástico bolha";
    case "FITA":
      return "Fita";
    default:
      return "Outro";
  }
}
