import { z } from "zod";

export const produtoFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    depositanteId: z.string().uuid("Selecione um depositante valido."),
    codigoInterno: z
      .string()
      .trim()
      .max(40, "O codigo interno deve ter no maximo 40 caracteres.")
      .optional()
      .or(z.literal("")),
    sku: z
      .string()
      .trim()
      .max(60, "O SKU deve ter no maximo 60 caracteres.")
      .optional()
      .or(z.literal("")),
    nome: z
      .string()
      .trim()
      .min(3, "Informe o nome do produto.")
      .max(160, "O nome do produto deve ter no maximo 160 caracteres."),
    eanGtin: z
      .string()
      .trim()
      .max(20, "O EAN/GTIN deve ter no maximo 20 caracteres.")
      .optional()
      .or(z.literal("")),
    categoria: z
      .string()
      .trim()
      .max(80, "A categoria deve ter no maximo 80 caracteres.")
      .optional()
      .or(z.literal("")),
    tipoProduto: z.enum(["SIMPLES", "KIT"]).default("SIMPLES"),
    metodoRetirada: z.enum(["FEFO", "FIFO", "LIFO"]),
    unidadeEstocagem: z.enum(["UNIDADE", "CAIXA", "PACK", "PALLET"]),
    quantidadePorEmbalagem: z.coerce.number().int().positive().optional(),
    exigeLote: z.coerce.boolean().default(false),
    exigeValidade: z.coerce.boolean().default(false),
    ativo: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.unidadeEstocagem === "CAIXA" || data.unidadeEstocagem === "PACK") {
      if (!data.quantidadePorEmbalagem || data.quantidadePorEmbalagem < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a quantidade de unidades por embalagem.",
          path: ["quantidadePorEmbalagem"],
        });
      }
    }
  });

export type ProdutoFormValues = z.infer<typeof produtoFormSchema>;
