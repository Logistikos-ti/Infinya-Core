import { z } from "zod";

export const receivingOrderItemSchema = z.object({
  produtoId: z.string().uuid("Selecione um produto válido."),
  quantidadePrevista: z.coerce
    .number()
    .positive("A quantidade prevista do item deve ser maior que zero."),
});

export const receivingOrderDraftSchema = z.object({
  depositanteId: z.string().uuid("Selecione um depositante válido."),
  fornecedor: z.string().min(2, "Informe o fornecedor."),
  notaFiscal: z.string().min(3, "Informe a nota fiscal."),
  previsao: z.string().min(1, "Informe a previsão de chegada."),
  doca: z.string().min(1, "Selecione a doca inicial."),
  volumes: z.coerce.number().positive("Volumes previstos devem ser maiores que zero."),
  skuCount: z.coerce.number().positive("Quantidade de SKUs deve ser maior que zero."),
  conferenciaLote: z.boolean(),
  conferenciaValidade: z.boolean(),
  observacoes: z.string().max(1000, "Observações devem ter no máximo 1000 caracteres."),
  items: z.array(receivingOrderItemSchema).min(1, "Adicione ao menos um produto ao recebimento."),
});

export type ReceivingOrderDraftInput = z.input<typeof receivingOrderDraftSchema>;
export type ReceivingOrderDraftPayload = z.infer<typeof receivingOrderDraftSchema>;

export const receivingConferenceItemSchema = z.object({
  id: z.string().uuid("Item de recebimento inválido."),
  quantidadeRecebida: z.coerce
    .number()
    .min(0, "A quantidade recebida não pode ser negativa."),
  lote: z.string().max(120, "O lote deve ter no máximo 120 caracteres.").optional(),
  validadeEm: z.string().optional(),
});

export const receivingConferenceSchema = z.object({
  enderecoId: z.string().uuid("Selecione um endereço válido."),
  finalizar: z.boolean().default(false),
  items: z
    .array(receivingConferenceItemSchema)
    .min(1, "É preciso informar ao menos um item para a conferência."),
});

export type ReceivingConferenceInput = z.input<typeof receivingConferenceSchema>;
export type ReceivingConferencePayload = z.infer<typeof receivingConferenceSchema>;
