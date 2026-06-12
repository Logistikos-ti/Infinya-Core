import type {
  ConfigModuleLink,
  ReceivingOrderDetail,
  ReceivingOrderListItem,
} from "@/types/wms";
import {
  addressBlueprint,
  configModules,
  depositantesResumo,
  nfeInbox,
  operationalIssues,
  productOverview,
  productChecklist,
  receivingStats,
  receivingOrderDetails,
  receivingOrders,
  receivingTasks,
  reportsCatalog,
  roadmapMilestones,
  routeLoads,
  stockMovements,
  stockStats,
  shippingFlow,
  shippingQueues,
  shippingStats,
  stockBalances,
  usersOverview,
} from "@/lib/mock-wms-data";

export function listReceivingOrders(): readonly ReceivingOrderListItem[] {
  return receivingOrders;
}

export function listReceivingStats() {
  return receivingStats;
}

export function getReceivingOrderById(id: string): ReceivingOrderDetail | null {
  return (
    receivingOrderDetails[id as keyof typeof receivingOrderDetails] ?? null
  );
}

export function listReceivingTasks() {
  return receivingTasks;
}

export function listOperationalIssues() {
  return operationalIssues;
}

export function listConfigModules(): readonly ConfigModuleLink[] {
  return configModules;
}

export function listRoadmapMilestones() {
  return roadmapMilestones;
}

export function listDepositantesResumo() {
  return depositantesResumo;
}

export function listUsersOverview() {
  return usersOverview;
}

export function listProductOverview() {
  return productOverview;
}

export function listProductChecklist() {
  return productChecklist;
}

export function listAddressBlueprint() {
  return addressBlueprint;
}

export function listStockStats() {
  return stockStats;
}

export function listStockBalances() {
  return stockBalances;
}

export function listStockMovements() {
  return stockMovements;
}

export function listShippingStats() {
  return shippingStats;
}

export function listShippingQueues() {
  return shippingQueues;
}

export function listShippingFlow() {
  return shippingFlow;
}

export function listRouteLoads() {
  return routeLoads;
}

export function listNfeInbox() {
  return nfeInbox;
}

export function listReportsCatalog() {
  return reportsCatalog;
}
