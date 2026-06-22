import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDepositanteConfiguracoes,
  updateDepositanteMercadoLivreConfig,
} from "@/lib/depositantes";
import {
  downloadMercadoLivreShipmentLabel,
  ensureValidMercadoLivreAccessToken,
  fetchMercadoLivreOrder,
  fetchMercadoLivreShipment,
  type MercadoLivreShipmentInfo,
} from "@/lib/mercado-livre";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";

type RawShippingOrder = {
  id: string;
  depositante_id: string;
  origem: string;
  payload_origem: Record<string, unknown> | null;
  configuracoes: unknown;
  observacoes: string | null;
};

export async function syncMercadoLivreAssetsForShippingOrder(
  adminSupabase: SupabaseClient,
  shippingOrderId: string,
) {
  const { data, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select(
      "id, depositante_id, origem, payload_origem, depositante:depositantes(configuracoes, observacoes)",
    )
    .eq("id", shippingOrderId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      status: "not_found" as const,
      message: "Pedido de expedição não encontrado.",
    };
  }

  const order = data as unknown as RawShippingOrder & {
    depositante?: { configuracoes?: unknown; observacoes?: string | null } | null;
  };
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const salesChannelCode = readSalesChannelCode(payload);

  if (salesChannelCode !== "MERCADO_LIVRE") {
    return {
      ok: false,
      status: "not_mercado_livre" as const,
      message: "Este pedido não está marcado como Mercado Livre.",
    };
  }

  const mercadoLivreData = getMercadoLivrePayload(payload);
  let shipmentId = mercadoLivreData.shipmentId;

  const rawConfig = order.depositante?.configuracoes
    ? JSON.stringify(order.depositante.configuracoes)
    : order.depositante?.observacoes ?? null;
  const config = parseDepositanteConfiguracoes(rawConfig);

  if (!config.mercadoLivre?.connected) {
    return {
      ok: false,
      status: "not_connected" as const,
      message: "O depositante não possui integração ativa com o Mercado Livre.",
    };
  }

  try {
    const tokenResult = await ensureValidMercadoLivreAccessToken(config.mercadoLivre);

    if (mercadoLivreData.orderId && (!shipmentId || shipmentId === mercadoLivreData.orderId)) {
      const orderInfo = await fetchMercadoLivreOrder(
        tokenResult.accessToken,
        mercadoLivreData.orderId,
      );
      shipmentId = orderInfo.shippingId;
    }

    if (!shipmentId) {
      return {
        ok: false,
        status: "missing_shipment" as const,
        message: mercadoLivreData.orderId
          ? "O pedido foi localizado no Mercado Livre, mas ainda não há envio vinculado disponível na API."
          : "O pedido ainda não possui shipment_id do Mercado Livre para sincronizar.",
      };
    }

    const shipment = await fetchMercadoLivreShipment(tokenResult.accessToken, shipmentId);

    const existingLabel = await findExistingLabel(adminSupabase, shippingOrderId);
    let labelStored = false;

    if (!existingLabel) {
      const labelDocument = await downloadMercadoLivreShipmentLabel(
        tokenResult.accessToken,
        shipmentId,
        "pdf",
      );

      await storeOperationalDocumentFromBuffer({
        adminSupabase,
        depositanteId: order.depositante_id,
        tipo: "ETIQUETA",
        fileName: labelDocument.fileName,
        mimeType: labelDocument.mimeType,
        bytes: labelDocument.bytes,
        pedidoExpedicaoId: shippingOrderId,
      });
      labelStored = true;
    }

    await updateShippingOrderPayload(adminSupabase, order, shipment, shipmentId);
    await persistMercadoLivreTokenRefresh(
      adminSupabase,
      order.depositante_id,
      rawConfig,
      config.mercadoLivre,
      tokenResult.tokens,
    );
    await persistMonitoring(adminSupabase, order.depositante_id, rawConfig, config.mercadoLivre, {
      lastTrackingSyncStatus: "SUCCESS",
      lastTrackingSyncMessage: shipment.trackingNumber
        ? `Rastreio ${shipment.trackingNumber} sincronizado com sucesso.`
        : "Envio sincronizado, mas ainda sem tracking number liberado.",
      lastTrackingSyncAt: new Date().toISOString(),
      lastLabelSyncStatus: "SUCCESS",
      lastLabelSyncMessage: labelStored
        ? "Etiqueta do Mercado Livre anexada automaticamente."
        : "Etiqueta já estava anexada no pedido.",
      lastLabelSyncAt: new Date().toISOString(),
    });

    return {
      ok: true,
      status: "synced" as const,
      message: labelStored
        ? "Etiqueta e rastreamento do Mercado Livre sincronizados com sucesso."
        : "Rastreamento sincronizado e etiqueta já existente preservada.",
    };
  } catch (error) {
    await persistMonitoring(adminSupabase, order.depositante_id, rawConfig, config.mercadoLivre, {
      lastTrackingSyncStatus: "ERROR",
      lastTrackingSyncMessage:
        error instanceof Error
          ? error.message
          : "Falha ao sincronizar rastreamento do Mercado Livre.",
      lastTrackingSyncAt: new Date().toISOString(),
      lastLabelSyncStatus: "ERROR",
      lastLabelSyncMessage:
        error instanceof Error
          ? error.message
          : "Falha ao sincronizar etiqueta do Mercado Livre.",
      lastLabelSyncAt: new Date().toISOString(),
    });

    return {
      ok: false,
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Falha ao sincronizar dados do Mercado Livre.",
    };
  }
}

async function findExistingLabel(adminSupabase: SupabaseClient, shippingOrderId: string) {
  const { data } = await adminSupabase
    .from("documentos_armazenados")
    .select("id")
    .eq("pedido_expedicao_id", shippingOrderId)
    .eq("tipo", "ETIQUETA")
    .limit(1)
    .maybeSingle();

  return data;
}

async function updateShippingOrderPayload(
  adminSupabase: SupabaseClient,
  order: RawShippingOrder,
  shipment: MercadoLivreShipmentInfo,
  shipmentId: string,
) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentTransporte = isRecord(payload.transporte) ? payload.transporte : {};
  const currentContato = isRecord(currentTransporte.contato) ? currentTransporte.contato : {};

  const nextPayload = {
    ...payload,
    mercadoLivre: {
      ...getMercadoLivrePayload(payload),
      shipmentId,
      trackingNumber: shipment.trackingNumber,
      trackingMethod: shipment.trackingMethod,
      status: shipment.status,
      substatus: shipment.substatus,
      logisticType: shipment.logisticType,
      lastSyncAt: new Date().toISOString(),
    },
    transporte: {
      ...currentTransporte,
      contato: {
        ...currentContato,
        nome: shipment.trackingMethod || currentContato.nome || "Mercado Envios",
      },
      volumes: [
        {
          servico: shipment.logisticType || shipment.trackingMethod || null,
          codigoRastreamento: shipment.trackingNumber || null,
        },
      ],
    },
  };

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      payload_origem: nextPayload,
      sincronizado_em: new Date().toISOString(),
    })
    .eq("id", order.id);
}

async function persistMercadoLivreTokenRefresh(
  adminSupabase: SupabaseClient,
  depositanteId: string,
  rawConfig: string | null,
  currentConfig: NonNullable<ReturnType<typeof parseDepositanteConfiguracoes>["mercadoLivre"]>,
  tokens: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  } | null,
) {
  if (!tokens) {
    return;
  }

  const nextConfig = {
    ...currentConfig,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? currentConfig.refreshToken,
    tokenType: tokens.token_type,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope
      ? tokens.scope
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : currentConfig.scopes,
    lastSyncAt: new Date().toISOString(),
  };

  await adminSupabase
    .from("depositantes")
    .update({
      configuracoes: updateDepositanteMercadoLivreConfig(rawConfig, nextConfig),
    })
    .eq("id", depositanteId);
}

async function persistMonitoring(
  adminSupabase: SupabaseClient,
  depositanteId: string,
  rawConfig: string | null,
  currentConfig: NonNullable<ReturnType<typeof parseDepositanteConfiguracoes>["mercadoLivre"]> | null,
  patch: Partial<
    NonNullable<
      NonNullable<ReturnType<typeof parseDepositanteConfiguracoes>["mercadoLivre"]>["monitoring"]
    >
  >,
) {
  if (!currentConfig) {
    return;
  }

  const nextConfig = {
    ...currentConfig,
    lastSyncAt: new Date().toISOString(),
    monitoring: {
      lastConnectionStatus: currentConfig.monitoring?.lastConnectionStatus ?? null,
      lastConnectionMessage: currentConfig.monitoring?.lastConnectionMessage ?? null,
      lastConnectionAt: currentConfig.monitoring?.lastConnectionAt ?? null,
      lastTrackingSyncStatus: currentConfig.monitoring?.lastTrackingSyncStatus ?? null,
      lastTrackingSyncMessage: currentConfig.monitoring?.lastTrackingSyncMessage ?? null,
      lastTrackingSyncAt: currentConfig.monitoring?.lastTrackingSyncAt ?? null,
      lastLabelSyncStatus: currentConfig.monitoring?.lastLabelSyncStatus ?? null,
      lastLabelSyncMessage: currentConfig.monitoring?.lastLabelSyncMessage ?? null,
      lastLabelSyncAt: currentConfig.monitoring?.lastLabelSyncAt ?? null,
      ...patch,
    },
  };

  await adminSupabase
    .from("depositantes")
    .update({
      configuracoes: updateDepositanteMercadoLivreConfig(rawConfig, nextConfig),
    })
    .eq("id", depositanteId);
}

function getMercadoLivrePayload(payload: Record<string, unknown>) {
  const ml = isRecord(payload.mercadoLivre) ? payload.mercadoLivre : {};
  const fallbackOrderId = readMercadoLivreOrderIdFromPayload(payload);

  return {
    orderId: readString(ml.orderId) ?? fallbackOrderId,
    shipmentId: readString(ml.shipmentId),
    trackingNumber: readString(ml.trackingNumber),
    trackingMethod: readString(ml.trackingMethod),
    status: readString(ml.status),
    substatus: readString(ml.substatus),
    logisticType: readString(ml.logisticType),
    lastSyncAt: readString(ml.lastSyncAt),
  };
}

function readMercadoLivreOrderIdFromPayload(payload: Record<string, unknown>) {
  const numeroLoja = readString(payload.numeroLoja);
  if (numeroLoja) {
    return numeroLoja;
  }

  const parcelas = Array.isArray(payload.parcelas) ? payload.parcelas : [];
  for (const parcela of parcelas) {
    if (!isRecord(parcela)) {
      continue;
    }

    const observacoes = readString(parcela.observacoes);
    if (!observacoes) {
      continue;
    }

    const match = observacoes.match(/Pedidos Vinculados:\s*([0-9,]+)/i);
    if (!match?.[1]) {
      continue;
    }

    const firstOrderId = match[1]
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);

    if (firstOrderId) {
      return firstOrderId;
    }
  }

  return null;
}

function readSalesChannelCode(payload: Record<string, unknown>) {
  const comercial = isRecord(payload.comercial) ? payload.comercial : null;
  return readString(comercial?.salesChannelCode);
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
