import type { BlingSaleOrderPayload } from "@/lib/bling";
import type { DepositanteBlingImportFilter } from "@/lib/depositantes";

export function evaluateBlingSaleOrderImport(
  filter: DepositanteBlingImportFilter | null,
  order: BlingSaleOrderPayload,
) {
  if (!filter?.enabled) {
    const status = normalize(order.situacao);
    const allowed = status.includes("em aberto") || status.includes("em andamento") || status === "aberto";
    return {
      allowed,
      reason: allowed
        ? null
        : `Pedido ignorado (status no Bling: '${order.situacao ?? "não informado"}'). O WMS importa novos pedidos em aberto ou em andamento.`,
    };
  }

  const statusAllowed = matches(
    order.situacaoId,
    order.situacao,
    filter.acceptedSituationIds,
    filter.acceptedSituationNames,
  );

  if (!statusAllowed) {
    return {
      allowed: false,
      reason: `Pedido ignorado: situação '${order.situacao ?? "não informada"}' fora da política configurada.`,
    };
  }

  const hasOriginFilter = Boolean(
    filter.allowedStoreIds.length ||
      filter.allowedStoreNames.length ||
      filter.allowedBusinessUnitIds.length ||
      filter.allowedBusinessUnitNames.length,
  );
  const originAllowed =
    !hasOriginFilter ||
    matches(order.loja?.id, order.loja?.nome, filter.allowedStoreIds, filter.allowedStoreNames) ||
    matches(
      order.unidadeNegocio?.id,
      order.unidadeNegocio?.nome,
      filter.allowedBusinessUnitIds,
      filter.allowedBusinessUnitNames,
    );

  return {
    allowed: originAllowed,
    reason: originAllowed
      ? null
      : `Pedido ignorado: loja '${order.loja?.nome ?? order.loja?.id ?? "não informada"}' e unidade '${order.unidadeNegocio?.nome ?? order.unidadeNegocio?.id ?? "não informada"}' não autorizadas.`,
  };
}

function matches(
  actualId: string | null | undefined,
  actualName: string | null | undefined,
  allowedIds: string[],
  allowedNames: string[],
) {
  const id = actualId?.trim();
  const name = normalize(actualName);
  return Boolean(
    (id && allowedIds.some((candidate) => candidate.trim() === id)) ||
      (name && allowedNames.some((candidate) => normalize(candidate) === name)),
  );
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}
