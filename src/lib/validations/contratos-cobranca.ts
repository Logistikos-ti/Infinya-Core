import { z } from "zod";

export const contratoCobrancaFormSchema = z.object({
  id: z.string().uuid().optional(),
  depositante_id: z.string().uuid("Selecione um depositante."),

  taxa_fulfillment: z.coerce.number().min(0).max(1),
  minimo_fulfillment: z.coerce.number().min(0),
  tarifa_posicao: z.coerce.number().min(0),
  valor_ponto_coleta: z.coerce.number().min(0),
  valor_impressao_nf: z.coerce.number().min(0),
  taxa_frete_fixa: z.coerce.number().min(0),
  taxa_frete_percentual: z.coerce.number().min(0).max(1),
  tarifa_recebimento: z.coerce.number().min(0),
  valor_logistica_reversa: z.coerce.number().min(0),
  valor_software: z.coerce.number().min(0),
  qtd_refrigeradores: z.coerce.number().int().min(0),
  valor_unitario_refrigerador: z.coerce.number().min(0),

  tipo_contrato: z.enum(["padrao", "consignado"]),
  vigencia_inicio: z.string().optional().default(""),
  vigencia_fim: z.string().optional().default(""),
  observacoes: z.string().max(2000).optional().default(""),
  ativo: z.boolean(),
});
