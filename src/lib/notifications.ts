import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUserContext } from "@/lib/auth";
import { isScopedDepositanteUser } from "@/lib/tenant-scope";
import { formatDateTimePtBr } from "@/lib/utils";

// Tipos de evento que hoje disparam notificação -- chamados de suporte
// NÃO passam por aqui: suporte_chamados/comentarios já tem seu próprio
// sistema de não-lidos (ver src/components/support/use-support-notifications.tsx),
// o sino só passa a também consultar aquele em paralelo.
export type NotificationType =
  | "ROMANEIO_LIBERADO"
  | "QUARENTENA_CRIADA"
  | "INVENTARIO_DIVERGENTE"
  | "RECEBIMENTO_CONCLUIDO"
  | "RECEBIMENTO_DIVERGENTE"
  | "EXPEDICAO_CANCELAMENTO_ABERTO"
  | "EXPEDICAO_DIVERGENTE"
  | "FATURA_GERADA"
  | "FATURA_VENCIDA"
  | "ESTOQUE_BAIXO";

export type AppNotification = {
  id: string;
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  link: string | null;
  // Usados pra remapear o link certo fora do dashboard interno (ex.: o
  // sino do portal do depositante -- `link` acima sempre aponta pra uma
  // rota do dashboard staff, nunca pro portal).
  referenciaTipo: string | null;
  referenciaId: string | null;
  criadoEm: string;
  criadoEmIso: string;
  lida: boolean;
};

/**
 * Cria uma notificação para um depositante específico. Nunca lança --
 * quem chama (romaneio liberado, quarentena criada, etc.) não pode falhar
 * por causa de uma notificação; erro só vai pro log.
 */
export async function createNotification(input: {
  tipo: NotificationType;
  titulo: string;
  mensagem: string;
  link?: string | null;
  depositanteId: string;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  criadoPor?: string | null;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("notificacoes").insert({
      tipo: input.tipo,
      titulo: input.titulo,
      mensagem: input.mensagem,
      link: input.link ?? null,
      depositante_id: input.depositanteId,
      referencia_tipo: input.referenciaTipo ?? null,
      referencia_id: input.referenciaId ?? null,
      criado_por: input.criadoPor ?? null,
    });
    if (error) {
      console.error("Falha ao criar notificação:", error.message);
    }
  } catch (error) {
    console.error("Falha ao criar notificação:", error);
  }
}

export async function listNotificationsForUser(
  user: AppUserContext,
  limit = 30,
  // ADMIN/TI "master preview" do portal de um depositante específico --
  // mesmo padrão de /api/suporte/notificacoes (route.ts:15-27): só um
  // usuário interno pode passar isso, nunca um DEPOSITANTE vendo o de
  // outro (isScopedDepositanteUser já barra e usa o próprio abaixo).
  overrideDepositanteId?: string | null,
): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("notificacoes")
    .select("id, tipo, titulo, mensagem, link, referencia_tipo, referencia_id, criado_em")
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (isScopedDepositanteUser(user) && user.depositanteId) {
    query = query.eq("depositante_id", user.depositanteId);
  } else if (overrideDepositanteId) {
    query = query.eq("depositante_id", overrideDepositanteId);
  }

  const { data: rows, error } = await query;
  if (error) {
    if (error.code === "42P01") return { notifications: [], unreadCount: 0 };
    throw new Error(`Não foi possível carregar as notificações: ${error.message}`);
  }

  const ids = (rows ?? []).map((row) => row.id);
  const { data: readRows } = ids.length
    ? await supabase
        .from("notificacoes_leituras")
        .select("notificacao_id")
        .eq("usuario_id", user.id)
        .in("notificacao_id", ids)
    : { data: [] as { notificacao_id: string }[] };
  const readIds = new Set((readRows ?? []).map((row) => row.notificacao_id));

  const notifications: AppNotification[] = (rows ?? []).map((row) => ({
    id: row.id,
    tipo: row.tipo as NotificationType,
    titulo: row.titulo,
    mensagem: row.mensagem,
    link: row.link,
    referenciaTipo: row.referencia_tipo,
    referenciaId: row.referencia_id,
    criadoEm: formatDateTimePtBr(row.criado_em),
    criadoEmIso: row.criado_em,
    lida: readIds.has(row.id),
  }));

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.lida).length,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notificacoes_leituras")
    .upsert({ notificacao_id: notificationId, usuario_id: userId }, { onConflict: "notificacao_id,usuario_id" });
  if (error) throw new Error(`Não foi possível marcar como lida: ${error.message}`);
}

export async function markAllNotificationsRead(user: AppUserContext) {
  const { notifications } = await listNotificationsForUser(user, 100);
  const unread = notifications.filter((item) => !item.lida);
  if (!unread.length) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notificacoes_leituras")
    .upsert(
      unread.map((item) => ({ notificacao_id: item.id, usuario_id: user.id })),
      { onConflict: "notificacao_id,usuario_id" },
    );
  if (error) throw new Error(`Não foi possível marcar tudo como lido: ${error.message}`);
}
