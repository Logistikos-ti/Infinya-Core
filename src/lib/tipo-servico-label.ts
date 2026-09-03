// Rótulo de exibição por tipo_servico — usado no extrato do financeiro (admin)
// e no detalhamento por blocos do drawer de fatura (admin + portal). Fonte
// única para não desalinhar dos textos que o drawer usa pra sub-agrupar
// (ex: financeiro-app.tsx checa e.tipo === "Ponto de coleta"/"Insumo"
// literalmente — mudar esses valores aqui quebra esse agrupamento).
export const TIPO_SERVICO_LABEL: Record<string, string> = {
  FULFILLMENT: "Fulfillment",
  PONTO_COLETA: "Ponto de coleta",
  IMPRESSAO_NF: "Impressão NF",
  CARTA_CORRECAO: "Carta de correção",
  OUTRO_DOCUMENTO: "Outro documento",
  GESTAO_FRETE: "Gestão de frete",
  ITEM_ADICIONAL: "Item adicional",
  CONFERENCIA: "Conferência unitária",
  URGENCIA: "Urgência",
  LOGISTICA_REVERSA: "Logística reversa",
  CANCELAMENTO: "Cancelamento",
  RETIRADA: "Retirada",
  DESCARTE: "Descarte",
  RECEBIMENTO: "Recebimento",
  ARMAZENAMENTO: "Armazenagem",
  SOFTWARE: "Software",
  INTEGRACAO: "Integração",
  AD_VALOREM: "Ad valorem",
  REFRIGERADOR: "Refrigerador",
  INSUMO: "Insumo",
  DESCONTO: "Desconto",
  COBRANCA_EXTRA: "Cobrança extra",
};
