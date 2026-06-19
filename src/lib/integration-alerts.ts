import { parseDepositanteConfiguracoes } from "@/lib/depositantes";

export type IntegrationAlertSeverity = "critical" | "warning" | "info";

export type IntegrationAlert = {
  id: string;
  depositanteId: string;
  depositante: string;
  severity: IntegrationAlertSeverity;
  title: string;
  message: string;
  source: "oauth" | "webhook" | "xml" | "reprocess";
  createdAt: string | null;
};

type DepositanteIntegrationRow = {
  id: string;
  nome: string;
  configuracoes: unknown;
  observacoes: string | null;
};

type ShippingOrderRow = {
  id: string;
  depositante_id: string;
  origem: string;
};

type LinkedDocumentRow = {
  pedido_expedicao_id: string | null;
  tipo: string;
};

export function buildIntegrationAlerts({
  depositantes,
  shippingOrders,
  linkedDocuments,
}: {
  depositantes: DepositanteIntegrationRow[];
  shippingOrders: ShippingOrderRow[];
  linkedDocuments: LinkedDocumentRow[];
}) {
  const alerts: IntegrationAlert[] = [];

  for (const depositante of depositantes) {
    const configuracoes = parseDepositanteConfiguracoes(
      depositante.configuracoes ? JSON.stringify(depositante.configuracoes) : depositante.observacoes,
    );
    const bling = configuracoes.bling;

    if (!bling?.connected) {
      continue;
    }

    const monitoring = bling.monitoring;
    const orderRows = shippingOrders.filter(
      (item) => item.depositante_id === depositante.id && item.origem === "BLING",
    );
    const documentRows = linkedDocuments.filter(
      (item) => item.pedido_expedicao_id && orderRows.some((order) => order.id === item.pedido_expedicao_id),
    );
    const ordersWithXml = new Set(
      documentRows
        .filter((item) => item.tipo === "NF")
        .map((item) => item.pedido_expedicao_id as string),
    );
    const pendingXmlCount = orderRows.filter((order) => !ordersWithXml.has(order.id)).length;

    if (monitoring?.lastConnectionStatus === "ERROR") {
      alerts.push({
        id: `${depositante.id}-oauth-error`,
        depositanteId: depositante.id,
        depositante: depositante.nome,
        severity: "critical",
        title: "Falha na conexão OAuth",
        message: monitoring.lastConnectionMessage ?? "A integração OAuth do Bling apresentou falha.",
        source: "oauth",
        createdAt: monitoring.lastConnectionAt,
      });
    }

    if (monitoring?.lastWebhookStatus === "ERROR") {
      alerts.push({
        id: `${depositante.id}-webhook-error`,
        depositanteId: depositante.id,
        depositante: depositante.nome,
        severity: "critical",
        title: "Falha no webhook do Bling",
        message: monitoring.lastWebhookMessage ?? "O último webhook não foi processado corretamente.",
        source: "webhook",
        createdAt: monitoring.lastWebhookAt ?? bling.webhook?.lastEventAt ?? null,
      });
    }

    if (monitoring?.lastReprocessStatus === "ERROR") {
      alerts.push({
        id: `${depositante.id}-reprocess-error`,
        depositanteId: depositante.id,
        depositante: depositante.nome,
        severity: "critical",
        title: "Falha no reprocessamento",
        message: monitoring.lastReprocessMessage ?? "O reprocessamento manual terminou com falha.",
        source: "reprocess",
        createdAt: monitoring.lastReprocessAt,
      });
    }

    if (pendingXmlCount > 0) {
      alerts.push({
        id: `${depositante.id}-xml-pending`,
        depositanteId: depositante.id,
        depositante: depositante.nome,
        severity: pendingXmlCount >= 5 ? "critical" : "warning",
        title: "Pedidos sem XML anexado",
        message: `${pendingXmlCount} pedido(s) Bling ainda sem XML anexado.`,
        source: "xml",
        createdAt: monitoring?.lastXmlSyncAt ?? bling.lastSyncAt,
      });
    }

    if (
      bling.webhook?.active &&
      (!bling.webhook.lastEventAt ||
        Date.now() - new Date(bling.webhook.lastEventAt).getTime() > 1000 * 60 * 30)
    ) {
      alerts.push({
        id: `${depositante.id}-webhook-stale`,
        depositanteId: depositante.id,
        depositante: depositante.nome,
        severity: "warning",
        title: "Webhook sem evento recente",
        message: "Nenhum webhook novo foi registrado nos últimos 30 minutos.",
        source: "webhook",
        createdAt: bling.webhook.lastEventAt,
      });
    }
  }

  return alerts.sort((a, b) => {
    const severityWeight = { critical: 0, warning: 1, info: 2 };
    const bySeverity = severityWeight[a.severity] - severityWeight[b.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}
