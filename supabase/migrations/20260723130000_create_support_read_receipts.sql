create table if not exists public.suporte_leituras (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  chamado_id uuid not null references public.suporte_chamados(id) on delete cascade,
  lido_ate timestamptz not null default now(),
  primary key (usuario_id, chamado_id)
);

create index if not exists suporte_leituras_usuario_idx
  on public.suporte_leituras (usuario_id, lido_ate desc);

alter table public.suporte_leituras enable row level security;

drop policy if exists suporte_leituras_select on public.suporte_leituras;
create policy suporte_leituras_select on public.suporte_leituras
for select to authenticated
using (usuario_id = auth.uid());

drop policy if exists suporte_leituras_insert on public.suporte_leituras;
create policy suporte_leituras_insert on public.suporte_leituras
for insert to authenticated
with check (usuario_id = auth.uid());

drop policy if exists suporte_leituras_update on public.suporte_leituras;
create policy suporte_leituras_update on public.suporte_leituras
for update to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());
