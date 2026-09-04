import { getSalesChannelLabel } from "@/lib/sales-channels";

/**
 * Nomes de rede de coleta usados quando o operador escolhe "Coleta
 * Marketplace" como transportadora física de um pedido. Espelha os mesmos
 * nomes que src/lib/shipping.ts (inferCarrierNameFromService) já assume
 * como fallback de exibição para pedidos importados via XML -- mantendo os
 * dois pontos consistentes.
 */
const KNOWN_MARKETPLACE_CARRIER_NETWORKS: Record<string, string> = {
  MERCADO_LIVRE: "Mercado Envios",
  SHOPEE: "Shopee Xpress",
  AMAZON: "Amazon Transportes",
  MAGALU: "Magalu Entregas",
  OLIST: "Olist",
};

/**
 * Resolve o nome real da rede de coleta do marketplace para o canal de
 * venda informado. Canais sem rede própria conhecida (Shein, TikTok, Kwai,
 * Magazine Luiza, Loja Integrada, etc.) recebem um rótulo textual seguro
 * (`Coleta <canal>`) em vez de um nome de marca inventado.
 */
export function resolveMarketplaceCarrierName(channelCode: string): string {
  const known = KNOWN_MARKETPLACE_CARRIER_NETWORKS[channelCode];
  if (known) {
    return known;
  }

  const label = getSalesChannelLabel(channelCode) ?? channelCode;
  return `Coleta ${label}`;
}
