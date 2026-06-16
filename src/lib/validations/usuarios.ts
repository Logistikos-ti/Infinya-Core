import { z } from "zod";

const baseUsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do usuário.")
    .max(120, "O nome deve ter no máximo 120 caracteres."),
  email: z.email("Informe um e-mail válido."),
  papel: z.enum(["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"]),
  depositanteId: z.string().uuid().nullable(),
  ativo: z.boolean().default(true),
});

export const usuarioFormSchema = baseUsuarioSchema
  .extend({
    senha: z
      .string()
      .min(8, "A senha inicial deve ter no mínimo 8 caracteres.")
      .max(72, "A senha inicial deve ter no máximo 72 caracteres."),
  })
  .superRefine((value, ctx) => {
    if (value.papel === "DEPOSITANTE" && !value.depositanteId) {
      ctx.addIssue({
        code: "custom",
        path: ["depositanteId"],
        message: "Usuários do tipo depositante precisam estar vinculados a um depositante.",
      });
    }
  });

export const usuarioUpdateFormSchema = baseUsuarioSchema
  .extend({
    id: z.string().uuid(),
    senha: z
      .string()
      .trim()
      .max(72, "A nova senha deve ter no máximo 72 caracteres.")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.papel === "DEPOSITANTE" && !value.depositanteId) {
      ctx.addIssue({
        code: "custom",
        path: ["depositanteId"],
        message: "Usuários do tipo depositante precisam estar vinculados a um depositante.",
      });
    }

    if (value.senha && value.senha.length > 0 && value.senha.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["senha"],
        message: "A nova senha deve ter no mínimo 8 caracteres.",
      });
    }
  });
