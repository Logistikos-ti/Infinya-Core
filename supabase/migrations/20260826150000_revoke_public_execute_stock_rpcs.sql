-- Falha de autorizacao: toda funcao "security definer" criada neste projeto
-- so' recebeu "grant execute ... to service_role" (ou, no melhor caso,
-- "revoke all ... from anon, authenticated"), mas o Postgres concede EXECUTE
-- a PUBLIC por padrao ao criar uma funcao -- e "anon"/"authenticated" herdam
-- de PUBLIC a menos que seja revogado explicitamente DE PUBLIC. Resultado:
-- qualquer pessoa de posse da anon key (publica, embutida no bundle do
-- site) conseguia chamar essas funcoes via /rest/v1/rpc/<nome> sem estar
-- logada, para qualquer depositante, porque sao "security definer" (rodam
-- com privilegio elevado, ignorando RLS). Confirmado empiricamente em
-- 2026-08-26 contra o projeto Supabase real.
--
-- Este fix so' revoga de PUBLIC (nunca teve motivo pra estar l'a) e mant'em
-- o grant existente pro service_role -- zero impacto funcional, porque toda
-- chamada do app sempre passa pelo admin client (service_role) atras de um
-- requireApiRoleAccess/requireApiModuleAccess no servidor.
revoke all on function public.dividir_lote_estoque(uuid, numeric, text, date, uuid) from public;
revoke all on function public.criar_quarentena_estoque(uuid, numeric, text, uuid, text, text) from public;
revoke all on function public.resolver_quarentena_estoque(uuid, text, uuid, text) from public;
revoke all on function public.reservar_estoque_pedido_criado(uuid, uuid) from public;
revoke all on function public.registrar_bipagem_separacao(uuid, uuid, uuid, numeric, uuid, uuid) from public;
revoke all on function public.garantir_baixa_fisica_pedido(uuid, uuid) from public;
revoke all on function public.estornar_baixas_separacao(uuid, uuid, text) from public;
revoke all on function public.reservar_item_pedido_expedicao(uuid, uuid) from public;
revoke all on function public.liberar_reserva_item_expedicao(uuid, uuid, text) from public;
revoke all on function public.requisitos_estoque_item_expedicao(uuid) from public;

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
