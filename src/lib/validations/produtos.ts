import { z } from "zod";

export const produtoFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    depositanteId: z.string().uuid("Selecione um depositante válido."),
    codigoInterno: z
      .string()
      .trim()
      .min(2, "Informe um código interno com pelo menos 2 caracteres.")
      .max(40, "O código interno deve ter no máximo 40 caracteres."),
    sku: z
      .string()
      .trim()
      .min(2, "Informe um SKU com pelo menos 2 caracteres.")
      .max(60, "O SKU deve ter no máximo 60 caracteres."),
    nome: z
      .string()
      .trim()
      .min(3, "Informe o nome do produto.")
      .max(160, "O nome do produto deve ter no máximo 160 caracteres."),
    eanGtin: z
      .string()
      .trim()
      .max(20, "O EAN/GTIN deve ter no máximo 20 caracteres.")
      .optional()
      .or(z.literal("")),
    categoria: z
      .string()
      .trim()
      .max(80, "A categoria deve ter no máximo 80 caracteres.")
      .optional()
      .or(z.literal("")),
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
