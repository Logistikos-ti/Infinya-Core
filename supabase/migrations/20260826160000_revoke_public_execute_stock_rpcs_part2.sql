-- Continuacao do fix de 20260826150000: mesma falha (EXECUTE herdado de
-- PUBLIC nunca revogado), agora nas demais funcoes "security definer" do
-- nucleo do WMS que a auditoria completa encontrou -- incluindo duas
-- (conciliar_baixa_retroativa_pedido, efetivar_baixa_conferencia) que a
-- primeira leva do fix acabou nao cobrindo, uma (efetivar_baixa_conferencia)
-- que nem chegou a ser usada pelo app mas continua instalada e chamavel, e
-- as funcoes de trigger (prefixo trg_/proteger_/registrar_auditoria_tabela)
-- que, apesar de nao serem exploraveis via RPC direto (Postgres exige
-- contexto de trigger pra referenciar NEW/OLD), ficam trancadas por
-- profundidade de defesa e passam a ter uma concessao explicita ao
-- service_role, ja que nenhuma delas tinha qualquer grant registrado antes.
--
-- Fora do escopo deste arquivo, de proposito: garantir_ou_criar_fatura,
-- recalcular_totais_fatura e snapshot_armazenamento_diario (modulo
-- financeiro/faturamento) tem a MESMA falha, mas pertencem a uma migration
-- ainda em desenvolvimento por outra sessao em paralelo -- precisam do
-- mesmo tipo de correcao, so' que coordenada com quem esta construindo
-- aquele modulo, entao ficam de fora por enquanto.
revoke all on function public.conciliar_baixa_retroativa_pedido(uuid, uuid) from public;
revoke all on function public.efetivar_baixa_conferencia(uuid, uuid) from public;
revoke all on function public.finalize_general_inventory(uuid, uuid) from public;
revoke all on function public.liberar_reserva_retirada(uuid, text, uuid) from public;
revoke all on function public.next_recebimento_codigo_seq() from public;
revoke all on function public.proteger_transicao_estoque_pedido() from public;
revoke all on function public.reservar_estoque_retirada(uuid, uuid) from public;
revoke all on function public.registrar_decisao_quarentena(uuid, text, uuid, text) from public;
revoke all on function public.registrar_auditoria_tabela() from public;
revoke all on function public.reservar_pedido_para_conferencia(uuid, uuid) from public;
revoke all on function public.trg_liberar_reserva_item_expedicao() from public;
revoke all on function public.trg_reabrir_reserva_pedido_cancelado() from public;
revoke all on function public.trg_reservar_item_pedido_expedicao() from public;

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
