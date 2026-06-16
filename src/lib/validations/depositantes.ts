import { z } from "zod";

export const depositanteFormSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .min(2, "Informe um código com pelo menos 2 caracteres.")
    .max(30, "O código deve ter no máximo 30 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome fantasia do depositante.")
    .max(120, "O nome fantasia deve ter no máximo 120 caracteres."),
  razaoSocial: z
    .string()
    .trim()
    .min(3, "Informe a razão social do depositante.")
    .max(160, "A razão social deve ter no máximo 160 caracteres."),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2}$/, "Informe um CNPJ válido."),
  enderecoFiscalCep: z
    .string()
    .trim()
    .max(9, "Informe um CEP válido com até 9 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalLogradouro: z
    .string()
    .trim()
    .max(160, "O logradouro deve ter no máximo 160 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalNumero: z
    .string()
    .trim()
    .max(20, "O número deve ter no máximo 20 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalComplemento: z
    .string()
    .trim()
    .max(120, "O complemento deve ter no máximo 120 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalBairro: z
    .string()
    .trim()
    .max(120, "O bairro deve ter no máximo 120 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalCidade: z
    .string()
    .trim()
    .max(120, "A cidade deve ter no máximo 120 caracteres.")
    .optional()
    .or(z.literal("")),
  enderecoFiscalUf: z
    .string()
    .trim()
    .max(2, "A UF deve ter no máximo 2 caracteres.")
    .optional()
    .or(z.literal("")),
  observacoes: z
    .string()
    .trim()
    .max(500, "As observações devem ter no máximo 500 caracteres.")
    .optional()
    .or(z.literal("")),
  metodoRetiradaPadrao: z.enum(["FEFO", "FIFO", "LIFO"]),
  exigeLotePadrao: z.coerce.boolean().default(true),
  exigeValidadePadrao: z.coerce.boolean().default(true),
  permiteFracionamento: z.coerce.boolean().default(false),
  diasMinimosValidade: z.coerce
    .number()
    .min(0, "Os dias mínimos de validade não podem ser negativos.")
    .max(999, "Informe no máximo 999 dias."),
  prefixoRecebimento: z
    .string()
    .trim()
    .max(12, "O prefixo deve ter no máximo 12 caracteres.")
    .optional()
    .or(z.literal("")),
  ativo: z.coerce.boolean().default(true),
});

export type DepositanteFormValues = z.infer<typeof depositanteFormSchema>;
