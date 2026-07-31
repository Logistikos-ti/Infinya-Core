create extension if not exists moddatetime schema extensions;

create table if not exists public.transportadoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  razao_social text not null,
  cnpj text not null,
  email text,
  telefone text,
  modalidades jsonb not null default '[]'::jsonb,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- RLS
alter table public.transportadoras enable row level security;

create policy "Transportadoras são visíveis para usuários autenticados"
  on public.transportadoras for select
  to authenticated
  using (true);

create policy "Apenas admins podem inserir transportadoras"
  on public.transportadoras for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and papel = 'TI'
    )
  );

create policy "Apenas admins podem atualizar transportadoras"
  on public.transportadoras for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and papel = 'TI'
    )
  )
  with check (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and papel = 'TI'
    )
  );

create policy "Apenas admins podem deletar transportadoras"
  on public.transportadoras for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios
      where id = auth.uid() and papel = 'TI'
    )
  );

-- Trigger para updated_at
create trigger handle_updated_at before update on public.transportadoras
  for each row execute procedure moddatetime (updated_at);
