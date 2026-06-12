import { z } from "zod";

export const receivingOrderDraftSchema = z.object({
  depositante: z.string().min(1, "Selecione um depositante."),
  fornecedor: z.string().min(2, "Informe o fornecedor."),
  notaFiscal: z.string().min(3, "Informe a nota fiscal."),
  previsao: z.string().min(1, "Informe a previsao de chegada."),
  doca: z.string().min(1, "Selecione a doca inicial."),
  volumes: z.coerce.number().positive("Volumes previstos devem ser maiores que zero."),
  skuCount: z.coerce.number().positive("Quantidade de SKUs deve ser maior que zero."),
  conferenciaLote: z.boolean(),
  conferenciaValidade: z.boolean(),
  observacoes: z.string().max(1000, "Observações devem ter no máximo 1000 caracteres."),
});

export type ReceivingOrderDraftInput = z.input<typeof receivingOrderDraftSchema>;
export type ReceivingOrderDraftPayload = z.infer<typeof receivingOrderDraftSchema>;
