-- The previous two fixes (20260826150000, 20260826160000) only did
-- "revoke all ... from public", which removes the implicit PUBLIC-default
-- EXECUTE grant Postgres adds at CREATE FUNCTION time. That was the right
-- fix for some functions, but a live pg_proc.proacl audit on 2026-08-26
-- found that most of these functions ALSO carry a separate, explicit
-- "anon=X" grant that predates this work and is not recorded in any
-- tracked migration (most likely a manual grant run directly in the SQL
-- editor at some point, for local testing, and never revoked). Revoking
-- from PUBLIC alone does not remove that direct grant -- anon could still
-- call these functions unauthenticated the whole time.
--
-- This migration revokes from public, anon, AND authenticated explicitly
-- and together, so it closes the gap regardless of which mechanism
-- (implicit PUBLIC default, or a direct historical grant) is currently
-- granting access -- then re-grants only what's actually needed.
revoke all on function public.dividir_lote_estoque(uuid, numeric, text, date, uuid) from public, anon, authenticated;
revoke all on function public.criar_quarentena_estoque(uuid, numeric, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.resolver_quarentena_estoque(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.reservar_estoque_pedido_criado(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_bipagem_separacao(uuid, uuid, uuid, numeric, uuid, uuid) from public, anon, authenticated;
revoke all on function public.garantir_baixa_fisica_pedido(uuid, uuid) from public, anon, authenticated;
revoke all on function public.estornar_baixas_separacao(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reservar_item_pedido_expedicao(uuid, uuid) from public, anon, authenticated;
revoke all on function public.liberar_reserva_item_expedicao(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.requisitos_estoque_item_expedicao(uuid) from public, anon, authenticated;
revoke all on function public.conciliar_baixa_retroativa_pedido(uuid, uuid) from public, anon, authenticated;
revoke all on function public.efetivar_baixa_conferencia(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_general_inventory(uuid, uuid) from public, anon, authenticated;
revoke all on function public.liberar_reserva_retirada(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.next_recebimento_codigo_seq() from public, anon, authenticated;
revoke all on function public.proteger_transicao_estoque_pedido() from public, anon, authenticated;
revoke all on function public.reservar_estoque_retirada(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_decisao_quarentena(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.registrar_auditoria_tabela() from public, anon, authenticated;
revoke all on function public.reservar_pedido_para_conferencia(uuid, uuid) from public, anon, authenticated;
revoke all on function public.trg_liberar_reserva_item_expedicao() from public, anon, authenticated;
revoke all on function public.trg_reabrir_reserva_pedido_cancelado() from public, anon, authenticated;
revoke all on function public.trg_reservar_item_pedido_expedicao() from public, anon, authenticated;

grant execute on function public.dividir_lote_estoque(uuid, numeric, text, date, uuid) to service_role;
grant execute on function public.criar_quarentena_estoque(uuid, numeric, text, uuid, text, text) to service_role;
grant execute on function public.resolver_quarentena_estoque(uuid, text, uuid, text) to service_role;
grant execute on function public.reservar_estoque_pedido_criado(uuid, uuid) to service_role;
grant execute on function public.registrar_bipagem_separacao(uuid, uuid, uuid, numeric, uuid, uuid) to service_role;
grant execute on function public.garantir_baixa_fisica_pedido(uuid, uuid) to service_role;
grant execute on function public.estornar_baixas_separacao(uuid, uuid, text) to service_role;
grant execute on function public.reservar_item_pedido_expedicao(uuid, uuid) to service_role;
grant execute on function public.liberar_reserva_item_expedicao(uuid, uuid, text) to service_role;
grant execute on function public.requisitos_estoque_item_expedicao(uuid) to service_role;
grant execute on function public.conciliar_baixa_retroativa_pedido(uuid, uuid) to service_role;
grant execute on function public.efetivar_baixa_conferencia(uuid, uuid) to service_role;
grant execute on function public.finalize_general_inventory(uuid, uuid) to authenticated, service_role;
grant execute on function public.liberar_reserva_retirada(uuid, text, uuid) to service_role;
grant execute on function public.next_recebimento_codigo_seq() to authenticated, service_role;
grant execute on function public.proteger_transicao_estoque_pedido() to service_role;
grant execute on function public.reservar_estoque_retirada(uuid, uuid) to service_role;
grant execute on function public.registrar_decisao_quarentena(uuid, text, uuid, text) to service_role;
grant execute on function public.registrar_auditoria_tabela() to service_role;
grant execute on function public.reservar_pedido_para_conferencia(uuid, uuid) to service_role;
grant execute on function public.trg_liberar_reserva_item_expedicao() to service_role;
grant execute on function public.trg_reabrir_reserva_pedido_cancelado() to service_role;
grant execute on function public.trg_reservar_item_pedido_expedicao() to service_role;
