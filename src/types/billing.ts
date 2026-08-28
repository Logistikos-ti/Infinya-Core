export type TipoServico =
  | "FULFILLMENT"
  | "PONTO_COLETA"
  | "IMPRESSAO_NF"
  | "GESTAO_FRETE"
  | "RECEBIMENTO"
  | "ARMAZENAMENTO"
  | "INSUMO"
  | "LOGISTICA_REVERSA"
  | "SOFTWARE"
  | "REFRIGERADOR"
  | "CARTA_CORRECAO"
  | "OUTRO_DOCUMENTO"
  | "DESCONTO"
  | "COBRANCA_EXTRA";

export type OrigemLancamento = "AUTOMATICO" | "MANUAL" | "CRON" | "ESTORNO";

export type ReferenciaTipo =
  | "PEDIDO_EXPEDICAO"
  | "PEDIDO_RECEBIMENTO"
  | "ROMANEIO"
  | "SNAPSHOT_ARMAZENAMENTO"
  | "DOCUMENTO_ARMAZENADO"
  | "INSUMO_CONSUMO";

export type StatusFatura = "ABERTA" | "FECHADA" | "ENVIADA" | "PAGO";

export type TipoContrato = "padrao" | "consignado";

export type ContratoCobranca = {
  id: string;
  depositanteId: string;
  taxaFulfillment: number;
  minimoFulfillment: number;
  tarifaPosicao: number;
  valorPontoColeta: number;
  marketplacesPontoColeta: string[];
  valorImpressaoNf: number;
  taxaFreteFixa: number;
  taxaFretePercentual: number;
  tarifaRecebimento: number;
  insumosDepositante: string[];
  valorSoftware: number;
  qtdRefrigeradores: number;
  valorUnitarioRefrigerador: number;
  tipoContrato: TipoContrato;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export type Lancamento = {
  id: string;
  depositanteId: string;
  faturaId: string | null;
  mesAno: string;
  tipoServico: TipoServico;
  origem: OrigemLancamento;
  referenciaTipo: ReferenciaTipo | null;
  referenciaId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  memoriaCalculo: Record<string, unknown> | null;
  contratoSnapshot: Record<string, unknown> | null;
  estornado: boolean;
  createdAt: string;
};

export type Fatura = {
  id: string;
  depositanteId: string;
  mesAno: string;
  status: StatusFatura;
  totalServicos: number;
  totalDescontos: number;
  totalAPagar: number;
  boletoUrl: string | null;
  boletoNome: string | null;
  nfUrl: string | null;
  nfNome: string | null;
  fechadoEm: string | null;
  observacoes: string | null;
  createdAt: string;
};

export type ArmazenamentoDiario = {
  id: string;
  depositanteId: string;
  data: string;
  qtdPosicoesOcupadas: number;
  detalhamento: Record<string, unknown> | null;
};

export type InsumoCatalogo = {
  id: string;
  nome: string;
  unidade: string;
  precoUnitario: number;
  ordem: number;
  ativo: boolean;
};
