export const TRANSPORTADORA_MODALIDADES = [
  "RODOVIARIO",
  "AEREO",
  "EXPRESSO",
  "ECONOMICO",
  "SAME_DAY",
  "FULFILLMENT",
  "FRACIONADO",
  "DEDICADO",
  "COLETA_REVERSA",
] as const;

export type TransportadoraModalidade = (typeof TRANSPORTADORA_MODALIDADES)[number];

export const TRANSPORTADORA_TIPOS = ["RODOVIARIO", "AEREO", "MARITIMO"] as const;

export type TransportadoraTipo = (typeof TRANSPORTADORA_TIPOS)[number];

export type TransportadoraListItem = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipo: TransportadoraTipo | null;
  modalidades: TransportadoraModalidade[];
  observacoes: string | null;
  ativo: boolean;
  createdAt: string;
  romaneiosMes: number;
  veiculos: number;
};

export function normalizeTransportadoraModalidades(values: string[]) {
  return values.filter((value): value is TransportadoraModalidade =>
    TRANSPORTADORA_MODALIDADES.includes(value as TransportadoraModalidade),
  );
}

export function formatTransportadoraModalidade(value: TransportadoraModalidade) {
  switch (value) {
    case "RODOVIARIO":
      return "Rodoviário";
    case "AEREO":
      return "Aéreo";
    case "EXPRESSO":
      return "Expresso";
    case "ECONOMICO":
      return "Econômico";
    case "SAME_DAY":
      return "Same day";
    case "FULFILLMENT":
      return "Fulfillment";
    case "FRACIONADO":
      return "Fracionado";
    case "DEDICADO":
      return "Dedicado";
    case "COLETA_REVERSA":
      return "Coleta reversa";
    default:
      return value;
  }
}

export function normalizeTransportadoraTipo(value: string): TransportadoraTipo | null {
  const upper = value.trim().toUpperCase();
  return TRANSPORTADORA_TIPOS.includes(upper as TransportadoraTipo)
    ? (upper as TransportadoraTipo)
    : null;
}

export function formatTransportadoraTipo(value: TransportadoraTipo | null) {
  switch (value) {
    case "RODOVIARIO":
      return "Rodoviário";
    case "AEREO":
      return "Aéreo";
    case "MARITIMO":
      return "Marítimo";
    default:
      return "—";
  }
}

export function transportadoraTipoColor(value: TransportadoraTipo | null) {
  switch (value) {
    case "RODOVIARIO":
      return "#3B82F6";
    case "AEREO":
      return "#8B5CF6";
    case "MARITIMO":
      return "#06B6D4";
    default:
      return "#64748B";
  }
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function isTransportadorasSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("transportadoras") === true;
}
