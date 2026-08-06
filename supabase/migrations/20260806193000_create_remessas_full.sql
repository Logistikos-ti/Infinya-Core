-- Remessas para fulfillment de marketplace (Full/FBA/Fulfillment).
-- Este fluxo nao entra na expedicao comum: representa a reposicao/coleta para o CD do marketplace.

create table if not exists public.remessas_full (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  codigo text not null unique,
  marketplace text not null,
  status text not null default 'DOCUMENTACAO_PENDENTE'
    check (status in ('DOCUMENTACAO_PENDENTE', 'PRONTA_PREPARACAO', 'AGUARDANDO_COLETA', 'COLETADA', 'CANCELADA')),
  nota_fiscal_numero text not null,
  chave_acesso text,
  emitente_nome text,
  emitente_documento text,
  destinatario_nome text,
  destinatario_documento text,
  destinatario_endereco text,
  transportadora_nome text,
  quantidade_volumes integer not null default 1,
  valor_total numeric(12, 2) not null default 0,
  coleta_prevista_em timestamptz not null,
  observacoes text,
  payload_origem jsonb not null default '{}'::jsonb,
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (depositante_id, chave_acesso)
);

create table if not exists public.remessas_full_itens (
  id uuid primary key default gen_random_uuid(),
  remessa_full_id uuid not null references public.remessas_full (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  codigo_produto text,
  sku text,
  ean text,
  nome text not null,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.remessas_full_documentos (
  id uuid primary key default gen_random_uuid(),
  remessa_full_id uuid not null references public.remessas_full (id) on delete cascade,
  remessa_full_item_id uuid references public.remessas_full_itens (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  tipo text not null check (tipo in ('XML_NF', 'AUTORIZACAO_ENTRADA', 'ETIQUETA_VOLUME', 'ETIQUETA_ITEM')),
  nome_arquivo text not null,
  caminho_storage text not null,
  mime_type text,
  tamanho_bytes bigint,
  enviado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_remessas_full_depositante_status
  on public.remessas_full (depositante_id, status, coleta_prevista_em);
create index if not exists idx_remessas_full_itens_remessa
  on public.remessas_full_itens (remessa_full_id);
create index if not exists idx_remessas_full_documentos_remessa
  on public.remessas_full_documentos (remessa_full_id);

drop trigger if exists remessas_full_set_updated_at on public.remessas_full;
create trigger remessas_full_set_updated_at
before update on public.remessas_full
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists remessas_full_itens_set_updated_at on public.remessas_full_itens;
create trigger remessas_full_itens_set_updated_at
before update on public.remessas_full_itens
for each row execute function public.set_current_timestamp_updated_at();

alter table public.remessas_full enable row level security;
alter table public.remessas_full_itens enable row level security;
alter table public.remessas_full_documentos enable row level security;

create policy "remessas_full_access"
on public.remessas_full for all to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "remessas_full_itens_access"
on public.remessas_full_itens for all to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "remessas_full_documentos_access"
on public.remessas_full_documentos for all to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
