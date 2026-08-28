import { z } from "zod";

export const transportadoraFormSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome fantasia da transportadora."),
  razaoSocial: z.string().trim().min(2, "Informe a razão social da transportadora."),
  cnpj: z
    .string()
    .trim()
    .min(14, "Informe um CNPJ válido.")
    .refine((value) => value.replace(/\D/g, "").length === 14, "Informe um CNPJ válido."),
  email: z.string().trim().email("Informe um e-mail válido.").or(z.literal("")),
  telefone: z.string().trim().min(8, "Informe um telefone válido.").or(z.literal("")),
  cidade: z.string().trim().max(120, "Limite de 120 caracteres."),
  uf: z
    .string()
    .trim()
    .max(2, "Use a sigla de 2 letras.")
    .or(z.literal("")),
  tipo: z.enum(["RODOVIARIO", "AEREO", "MARITIMO"], {
    message: "Selecione o tipo de transporte.",
  }),
  observacoes: z.string().trim().max(2000, "Limite de 2000 caracteres."),
  ativo: z.boolean(),
});
