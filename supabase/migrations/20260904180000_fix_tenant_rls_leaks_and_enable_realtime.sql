-- Duas falhas de isolamento por depositante encontradas ao preparar o
-- rollout de Supabase Realtime (ver abaixo): antes desta migration, qualquer
-- usuário autenticado -- inclusive uma sessão de portal (papel DEPOSITANTE)
-- de OUTRO depositante -- conseguia ler linhas de ondas_separacao(_pedidos)
-- e suporte_comentarios de qualquer depositante via chamada direta à API do
-- Supabase (REST ou Realtime), porque as políticas eram `using (true)` (ou
-- equivalente) em vez de checar o depositante do usuário. Ambas corrigidas
-- aqui para o mesmo padrão can_access_depositante() já usado em
-- pedidos_expedicao/romaneios_carga/contagens_estoque/etc.

-- ============================================================
-- 1. ondas_separacao / ondas_separacao_pedidos
--    Sem depositante_id direto -- escopo via pedidos_expedicao ligados à onda.
--    ADMIN/TI/OPERADOR continuam vendo tudo (can_access_depositante já cobre
--    isso); DEPOSITANTE só vê ondas com pelo menos um pedido seu.
-- ============================================================

drop policy if exists "ondas_separacao_access" on public.ondas_separacao;
create policy "ondas_separacao_access"
on public.ondas_separacao
for all
to authenticated
using (
  exists (
    select 1
    from public.ondas_separacao_pedidos osp
    join public.pedidos_expedicao pe on pe.id = osp.pedido_expedicao_id
    where osp.onda_separacao_id = ondas_separacao.id
      and public.can_access_depositante(pe.depositante_id)
  )
)
with check (
  public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
);

drop policy if exists "ondas_separacao_pedidos_access" on public.ondas_separacao_pedidos;
create policy "ondas_separacao_pedidos_access"
on public.ondas_separacao_pedidos
for all
to authenticated
using (
  exists (
    select 1
    from public.pedidos_expedicao pe
    where pe.id = ondas_separacao_pedidos.pedido_expedicao_id
      and public.can_access_depositante(pe.depositante_id)
  )
)
with check (
  public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
);

-- ============================================================
-- 2. suporte_comentarios
--    A política antiga só conferia se o chamado_id existia (sempre
--    verdadeiro), nunca o depositante/papel de quem lê -- efetivamente
--    `using (true)`. Mesmo padrão de suporte_chamados_select agora.
-- ============================================================

drop policy if exists suporte_comentarios_select on public.suporte_comentarios;
create policy suporte_comentarios_select on public.suporte_comentarios
for select to authenticated
using (
  exists (
    select 1
    from public.suporte_chamados c
    where c.id = chamado_id
      and (
        public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
        or c.depositante_id = public.current_depositante_id()
      )
  )
);

drop policy if exists suporte_comentarios_insert on public.suporte_comentarios;
create policy suporte_comentarios_insert on public.suporte_comentarios
for insert to authenticated
with check (
  autor_id = auth.uid()
  and exists (
    select 1
    from public.suporte_chamados c
    where c.id = chamado_id
      and (
        public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
        or c.depositante_id = public.current_depositante_id()
      )
  )
);

-- ============================================================
-- 3. bipagens_separacao / estoque_quarentena
--    Hoje só têm policy para service_role (ou nenhuma) -- sem vazamento,
--    mas sem leitura nenhuma para o cliente autenticado, o que impediria
--    Realtime de entregar qualquer evento. Adiciona SELECT escopado por
--    depositante; escrita continua só via service_role/RPC, como já é.
-- ============================================================

drop policy if exists bipagens_separacao_select on public.bipagens_separacao;
create policy bipagens_separacao_select on public.bipagens_separacao
for select to authenticated
using (
  exists (
    select 1
    from public.pedidos_expedicao pe
    where pe.id = bipagens_separacao.pedido_expedicao_id
      and public.can_access_depositante(pe.depositante_id)
  )
);

drop policy if exists estoque_quarentena_select on public.estoque_quarentena;
create policy estoque_quarentena_select on public.estoque_quarentena
for select to authenticated
using (public.can_access_depositante(depositante_id));

-- ============================================================
-- 4. Habilita Supabase Realtime (postgres_changes) nas tabelas por trás
--    das telas que devem atualizar sozinhas por modificação, sem precisar
--    de F5 -- romaneio, expedição/conferência, separação, quarentena,
--    inventário e chamados de suporte. Realtime respeita a mesma RLS de
--    SELECT de cada tabela para o client anon-key/autenticado, então só
--    entram aqui tabelas já corrigidas/confirmadas corretamente escopadas
--    acima ou anteriormente.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'romaneios_carga',
    'romaneios_carga_pedidos',
    'pedidos_expedicao',
    'pedidos_expedicao_itens',
    'ondas_separacao',
    'ondas_separacao_pedidos',
    'bipagens_separacao',
    'estoque_quarentena',
    'contagens_estoque',
    'contagens_estoque_itens',
    'inventarios_gerais',
    'inventarios_gerais_itens',
    'inventarios_gerais_participantes',
    'suporte_chamados',
    'suporte_comentarios',
    'suporte_leituras'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
