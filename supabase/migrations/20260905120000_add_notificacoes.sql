-- Modelo genérico de notificação cross-domain (sino no cabeçalho, hoje
-- 100% decorativo -- pedido do usuário em 2026-09-05 pra tornar
-- funcional). Cada linha é sempre escopada a UM depositante (mesmo pra
-- eventos operacionais como romaneio liberado): can_access_depositante()
-- já garante que ADMIN/TI/OPERADOR vejam tudo e DEPOSITANTE só o seu,
-- então não precisa de uma noção separada de "notificação interna".
--
-- Chamados de suporte NÃO entram aqui -- suporte_chamados/comentarios já
-- tem seu próprio sistema de não-lidos completo (tempo real + polling +
-- suporte_leituras), essa tabela só cobre os tipos novos.

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ROMANEIO_LIBERADO', 'QUARENTENA_CRIADA', 'INVENTARIO_DIVERGENTE')),
  titulo text not null,
  mensagem text not null,
  link text,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  referencia_tipo text,
  referencia_id uuid,
  criado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notificacoes_depositante_criado
  on public.notificacoes (depositante_id, criado_em desc);

-- Leitura por usuário (mesmo padrão de suporte_leituras) -- uma
-- notificação pode ser vista por várias pessoas (ex.: todo mundo do
-- depositante + ADMIN/TI/OPERADOR), cada uma marca como lida pra si.
create table if not exists public.notificacoes_leituras (
  notificacao_id uuid not null references public.notificacoes (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  lido_em timestamptz not null default timezone('utc', now()),
  primary key (notificacao_id, usuario_id)
);

alter table public.notificacoes enable row level security;
alter table public.notificacoes_leituras enable row level security;

drop policy if exists notificacoes_select on public.notificacoes;
create policy notificacoes_select on public.notificacoes
for select to authenticated
using (public.can_access_depositante(depositante_id));

-- Sem policy de insert/update/delete pra authenticated de propósito --
-- só o service_role (admin client, via src/lib/notifications.ts) cria
-- notificação, mesmo padrão de romaneios_carga/etc.

drop policy if exists notificacoes_leituras_select on public.notificacoes_leituras;
create policy notificacoes_leituras_select on public.notificacoes_leituras
for select to authenticated
using (usuario_id = auth.uid());

drop policy if exists notificacoes_leituras_insert on public.notificacoes_leituras;
create policy notificacoes_leituras_insert on public.notificacoes_leituras
for insert to authenticated
with check (usuario_id = auth.uid());

do $$
declare
  t text;
  tables text[] := array['notificacoes', 'notificacoes_leituras'];
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
