export const statusPedidoExpedicaoFluxo = [
  "GERADO",
  "EM_SEPARACAO",
  "SEPARADO",
  "EM_CONFERENCIA",
  "CONFERIDO",
  "EXPEDIDO",
] as const;

export const papeisUsuario = [
  "ADMIN",
  "TI",
  "OPERADOR",
  "DEPOSITANTE",
] as const;

export const metodosRetirada = ["FEFO", "FIFO", "LIFO"] as const;
