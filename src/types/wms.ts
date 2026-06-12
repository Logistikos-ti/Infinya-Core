import { metodosRetirada, papeisUsuario, statusPedidoExpedicaoFluxo } from "@/lib/constants";

export type StatusPedidoExpedicao = (typeof statusPedidoExpedicaoFluxo)[number];
export type PapelUsuario = (typeof papeisUsuario)[number];
export type MetodoRetirada = (typeof metodosRetirada)[number];
export type StatusPedidoRecebimento =
  | "RASCUNHO"
  | "AGUARDANDO"
  | "EM_RECEBIMENTO"
  | "RECEBIDO_PARCIAL"
  | "RECEBIDO"
  | "DIVERGENCIA"
  | "CANCELADO";
export type StatusTarefaRecebimento =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";
export type TipoTarefaRecebimento =
  | "DOCA"
  | "CONFERENCIA_FISICA"
  | "ETIQUETAGEM"
  | "ENDERECAMENTO"
  | "TRATATIVA_DIVERGENCIA";
export type TipoOcorrenciaOperacional =
  | "AVARIA"
  | "FALTA"
  | "SOBRA"
  | "VALIDADE"
  | "ENDERECAMENTO"
  | "DOCUMENTAL"
  | "OUTRO";

export type OrigemPedido =
  | "MANUAL"
  | "BLING"
  | "MERCADO_LIVRE"
  | "SHOPEE"
  | "NF_IMPORTADA"
  | "AREA_DO_CLIENTE";

export type Depositante = {
  id: string;
  codigo: string;
  nome: string;
  cnpj: string;
  ativo: boolean;
  logoUrl?: string | null;
};

export type Produto = {
  id: string;
  depositanteId: string;
  codigoInterno: string;
  codigoExterno?: string | null;
  nome: string;
  categoria?: string | null;
  unidadeEstocagem: "UNIDADE" | "CAIXA" | "PALLET";
  metodoRetirada: MetodoRetirada;
  qtdMinima?: number | null;
  qtdMaxima?: number | null;
  ativo: boolean;
};

export type ReceivingOrderListItem = {
  id: string;
  code: string;
  depositante: string;
  supplier: string;
  eta: string;
  status: string;
  skuCount: number;
  volumeCount: number;
};

export type ReceivingOrderDetailItem = {
  sku: string;
  description: string;
  expected: string;
  received: string;
  lot: string;
  expiry: string;
};

export type ReceivingOrderDetail = {
  code: string;
  depositante: string;
  supplier: string;
  status: string;
  eta: string;
  dock: string;
  noteNumber: string;
  volumes: number;
  skuCount: number;
  protocol: string;
  checklist: readonly string[];
  items: readonly ReceivingOrderDetailItem[];
};

export type ConfigModuleLink = {
  href: string;
  title: string;
  description: string;
};
