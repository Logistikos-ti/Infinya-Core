"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function criarTarefaAction(formData: FormData) {
  const user = await requireModuleAccess("configuracoes");

  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) {
    return { error: "Informe o texto da tarefa." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("configuracoes_tarefas")
    .insert({ texto, criado_por: user.id })
    .select("id, texto, concluida, criado_em")
    .single();

  if (error || !data) {
    return { error: "Não foi possível adicionar a tarefa." };
  }

  revalidatePath("/configuracoes");
  return { task: data };
}

export async function alternarTarefaAction(id: string, concluida: boolean) {
  const user = await requireModuleAccess("configuracoes");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("configuracoes_tarefas")
    .update({ concluida, concluido_em: concluida ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("criado_por", user.id);

  if (error) {
    return { error: "Não foi possível atualizar a tarefa." };
  }

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function excluirTarefaAction(id: string) {
  const user = await requireModuleAccess("configuracoes");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("configuracoes_tarefas")
    .delete()
    .eq("id", id)
    .eq("criado_por", user.id);

  if (error) {
    return { error: "Não foi possível remover a tarefa." };
  }

  revalidatePath("/configuracoes");
  return { success: true };
}
