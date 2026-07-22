create extension if not exists pgcrypto;

create table if not exists public.suporte_chamados (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  criado_por uuid not null references public.usuarios(id) on delete restrict,
  assunto text not null check (btrim(assunto) <> ''),
  categoria text not null default 'Outros',
  status text not null default 'Aberto' check (status in ('Aberto', 'Em análise', 'Resolvido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suporte_comentarios (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.suporte_chamados(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id) on delete restrict,
  texto text not null check (btrim(texto) <> ''),
  created_at timestamptz not null default now()
);

create index if not exists suporte_chamados_depositante_idx on public.suporte_chamados (depositante_id, created_at desc);
create index if not exists suporte_comentarios_chamado_idx on public.suporte_comentarios (chamado_id, created_at);

create or replace function public.suporte_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists suporte_chamados_touch_updated_at on public.suporte_chamados;
create trigger suporte_chamados_touch_updated_at
before update on public.suporte_chamados
for each row execute function public.suporte_touch_updated_at();

alter table public.suporte_chamados enable row level security;
alter table public.suporte_comentarios enable row level security;

drop policy if exists suporte_chamados_select on public.suporte_chamados;
create policy suporte_chamados_select on public.suporte_chamados
for select to authenticated
using (
  public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
  or depositante_id = public.current_depositante_id()
);

drop policy if exists suporte_chamados_insert on public.suporte_chamados;
create policy suporte_chamados_insert on public.suporte_chamados
for insert to authenticated
with check (
  criado_por = auth.uid()
  and (
    public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR')
    or depositante_id = public.current_depositante_id()
  )
);

drop policy if exists suporte_chamados_update on public.suporte_chamados;
create policy suporte_chamados_update on public.suporte_chamados
for update to authenticated
using (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'))
with check (public.current_papel_usuario() in ('ADMIN', 'TI', 'OPERADOR'));

drop policy if exists suporte_comentarios_select on public.suporte_comentarios;
create policy suporte_comentarios_select on public.suporte_comentarios
for select to authenticated
using (
  exists (
    select 1
    from public.suporte_chamados c
    where c.id = chamado_id
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
  )
);
