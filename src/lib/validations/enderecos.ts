import { z } from "zod";

export const enderecoFormSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z
    .string()
    .trim()
    .min(2, "Informe um código com pelo menos 2 caracteres.")
    .max(40, "O código deve ter no máximo 40 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(160, "A descrição deve ter no máximo 160 caracteres.")
    .optional()
    .or(z.literal("")),
  area: z.enum(["RECEBIMENTO", "PULMAO", "PICKING", "BLOQUEADO", "EXPEDICAO"]),
  rua: z
    .string()
    .trim()
    .max(30, "O corredor deve ter no máximo 30 caracteres.")
    .optional()
    .or(z.literal("")),
  modulo: z
    .string()
    .trim()
    .max(30, "O módulo deve ter no máximo 30 caracteres.")
    .optional()
    .or(z.literal("")),
  nivel: z
    .string()
    .trim()
    .max(30, "O nível deve ter no máximo 30 caracteres.")
    .optional()
    .or(z.literal("")),
  posicao: z
    .string()
    .trim()
    .max(30, "A posição deve ter no máximo 30 caracteres.")
    .optional()
    .or(z.literal("")),
  capacidadeMaxima: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(Number(value.replace(",", "."))), {
      message: "Informe uma capacidade válida.",
    }),
  unidadePadrao: z.enum(["UNIDADE", "CAIXA", "PALLET"]).optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});

export type EnderecoFormValues = z.infer<typeof enderecoFormSchema>;

export const gerarEnderecosFormSchema = z.object({
  area: z.enum(["RECEBIMENTO", "PULMAO", "PICKING", "BLOQUEADO", "EXPEDICAO"]),
  descricaoBase: z
    .string()
    .trim()
    .max(120, "A descrição base deve ter no máximo 120 caracteres.")
    .optional()
    .or(z.literal("")),
  corredorPrefixo: z
    .string()
    .trim()
    .min(1, "Informe o prefixo do corredor.")
    .max(10, "O prefixo do corredor deve ter no máximo 10 caracteres."),
  corredorInicio: z.coerce.number().int().min(1).max(999),
  corredorFim: z.coerce.number().int().min(1).max(999),
  moduloPrefixo: z
    .string()
    .trim()
    .min(1, "Informe o prefixo do módulo.")
    .max(10, "O prefixo do módulo deve ter no máximo 10 caracteres."),
  moduloInicio: z.coerce.number().int().min(1).max(999),
  moduloFim: z.coerce.number().int().min(1).max(999),
  nivelPrefixo: z
    .string()
    .trim()
    .min(1, "Informe o prefixo do nível.")
    .max(10, "O prefixo do nível deve ter no máximo 10 caracteres."),
  nivelInicio: z.coerce.number().int().min(1).max(999),
  nivelFim: z.coerce.number().int().min(1).max(999),
  posicaoPrefixo: z
    .string()
    .trim()
    .min(1, "Informe o prefixo da posição.")
    .max(10, "O prefixo da posição deve ter no máximo 10 caracteres."),
  posicaoInicio: z.coerce.number().int().min(1).max(999),
  posicaoFim: z.coerce.number().int().min(1).max(999),
  capacidadeMaxima: z
    .string()
    .trim()
    .refine((value) => !value || !Number.isNaN(Number(value.replace(",", "."))), {
      message: "Informe uma capacidade válida.",
    }),
  unidadePadrao: z.enum(["UNIDADE", "CAIXA", "PALLET"]).optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});
