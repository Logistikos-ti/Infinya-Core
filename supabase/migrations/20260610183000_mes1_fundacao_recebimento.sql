create extension if not exists pgcrypto;

create type public.papel_usuario as enum ('ADMIN', 'OPERADOR', 'DEPOSITANTE');
create type public.metodo_retirada as enum ('FEFO', 'FIFO', 'LIFO');
create type public.unidade_estocagem as enum ('UNIDADE', 'CAIXA', 'PALLET');
create type public.area_endereco as enum ('RECEBIMENTO', 'PULMAO', 'PICKING', 'BLOQUEADO', 'EXPEDICAO');
create type public.status_pedido_recebimento as enum ('RASCUNHO', 'AGUARDANDO', 'EM_RECEBIMENTO', 'RECEBIDO_PARCIAL', 'RECEBIDO', 'DIVERGENCIA', 'CANCELADO');
create type public.status_item_recebimento as enum ('PENDENTE', 'EM_CONFERENCIA', 'RECEBIDO', 'DIVERGENCIA');
create type public.status_tarefa_recebimento as enum ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');
create type public.tipo_tarefa_recebimento as enum ('DOCA', 'CONFERENCIA_FISICA', 'ETIQUETAGEM', 'ENDERECAMENTO', 'TRATATIVA_DIVERGENCIA');
create type public.tipo_ocorrencia_operacional as enum ('AVARIA', 'FALTA', 'SOBRA', 'VALIDADE', 'ENDERECAMENTO', 'DOCUMENTAL', 'OUTRO');
create type public.status_ocorrencia_operacional as enum ('ABERTA', 'EM_ANALISE', 'RESOLVIDA', 'CANCELADA');
create type public.tipo_documento as enum ('NF', 'CTE', 'ROMANEIO', 'CHECKLIST', 'FOTO', 'COMPROVANTE', 'OUTRO');
create type public.tipo_movimentacao_estoque as enum ('ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'BLOQUEIO', 'DESBLOQUEIO');

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.depositantes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  cnpj text not null unique,
  ativo boolean not null default true,
  logo_url text,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nome text not null,
  papel public.papel_usuario not null default 'OPERADOR',
  depositante_id uuid references public.depositantes (id) on delete set null,
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.enderecos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text,
  area public.area_endereco not null,
  rua text,
  modulo text,
  nivel text,
  posicao text,
  capacidade_maxima numeric(12, 3),
  unidade_padrao public.unidade_estocagem,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  codigo_interno text not null,
  codigo_externo text,
  sku text,
  nome text not null,
  descricao text,
  categoria text,
  metodo_retirada public.metodo_retirada not null default 'FEFO',
  unidade_estocagem public.unidade_estocagem not null default 'UNIDADE',
  exige_lote boolean not null default false,
  exige_validade boolean not null default false,
  peso_kg numeric(10, 3),
  altura_cm numeric(10, 2),
  largura_cm numeric(10, 2),
  comprimento_cm numeric(10, 2),
  qtd_minima numeric(12, 3),
  qtd_maxima numeric(12, 3),
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (depositante_id, codigo_interno)
);

create table public.pedidos_recebimento (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  codigo text not null unique,
  referencia_externa text,
  status public.status_pedido_recebimento not null default 'RASCUNHO',
  previsto_para date,
  recebido_em timestamptz,
  nota_fiscal_numero text,
  fornecedor_nome text,
  fornecedor_documento text,
  observacoes text,
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.pedidos_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_recebimento_id uuid not null references public.pedidos_recebimento (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  status public.status_item_recebimento not null default 'PENDENTE',
  quantidade_prevista numeric(12, 3) not null,
  quantidade_recebida numeric(12, 3) not null default 0,
  lote text,
  fabricacao_em date,
  validade_em date,
  observacoes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.recebimento_tarefas (
  id uuid primary key default gen_random_uuid(),
  pedido_recebimento_id uuid not null references public.pedidos_recebimento (id) on delete cascade,
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  tipo public.tipo_tarefa_recebimento not null,
  status public.status_tarefa_recebimento not null default 'PENDENTE',
  titulo text not null,
  descricao text,
  endereco_id uuid references public.enderecos (id) on delete set null,
  responsavel_id uuid references public.usuarios (id) on delete set null,
  prioridade smallint not null default 2,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ocorrencias_operacionais (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  pedido_recebimento_id uuid references public.pedidos_recebimento (id) on delete set null,
  item_recebimento_id uuid references public.pedidos_recebimento_itens (id) on delete set null,
  tipo public.tipo_ocorrencia_operacional not null,
  status public.status_ocorrencia_operacional not null default 'ABERTA',
  titulo text not null,
  descricao text not null,
  aberto_por uuid references public.usuarios (id) on delete set null,
  resolvido_por uuid references public.usuarios (id) on delete set null,
  resolvido_em timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.documentos_armazenados (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  pedido_recebimento_id uuid references public.pedidos_recebimento (id) on delete set null,
  tipo public.tipo_documento not null,
  nome_arquivo text not null,
  caminho_storage text not null,
  mime_type text,
  tamanho_bytes bigint,
  enviado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.estoque (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  endereco_id uuid not null references public.enderecos (id) on delete restrict,
  lote text,
  fabricacao_em date,
  validade_em date,
  quantidade numeric(12, 3) not null default 0,
  quantidade_reservada numeric(12, 3) not null default 0,
  bloqueado boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (depositante_id, produto_id, endereco_id, lote, validade_em)
);

create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes (id) on delete cascade,
  estoque_id uuid references public.estoque (id) on delete set null,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  endereco_origem_id uuid references public.enderecos (id) on delete set null,
  endereco_destino_id uuid references public.enderecos (id) on delete set null,
  tipo public.tipo_movimentacao_estoque not null,
  quantidade numeric(12, 3) not null,
  referencia_tipo text,
  referencia_id uuid,
  observacoes text,
  criado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_usuarios_depositante_id on public.usuarios (depositante_id);
create index idx_produtos_depositante_id on public.produtos (depositante_id);
create index idx_pedidos_recebimento_depositante_id on public.pedidos_recebimento (depositante_id);
create index idx_pedidos_recebimento_status on public.pedidos_recebimento (status);
create index idx_pedidos_recebimento_itens_pedido_id on public.pedidos_recebimento_itens (pedido_recebimento_id);
create index idx_recebimento_tarefas_depositante_id on public.recebimento_tarefas (depositante_id);
create index idx_recebimento_tarefas_status on public.recebimento_tarefas (status);
create index idx_ocorrencias_operacionais_depositante_id on public.ocorrencias_operacionais (depositante_id);
create index idx_estoque_depositante_produto on public.estoque (depositante_id, produto_id);
create index idx_movimentacoes_estoque_depositante_id on public.movimentacoes_estoque (depositante_id);

create trigger depositantes_set_updated_at
before update on public.depositantes
for each row
execute function public.set_current_timestamp_updated_at();

create trigger usuarios_set_updated_at
before update on public.usuarios
for each row
execute function public.set_current_timestamp_updated_at();

create trigger enderecos_set_updated_at
before update on public.enderecos
for each row
execute function public.set_current_timestamp_updated_at();

create trigger produtos_set_updated_at
before update on public.produtos
for each row
execute function public.set_current_timestamp_updated_at();

create trigger pedidos_recebimento_set_updated_at
before update on public.pedidos_recebimento
for each row
execute function public.set_current_timestamp_updated_at();

create trigger pedidos_recebimento_itens_set_updated_at
before update on public.pedidos_recebimento_itens
for each row
execute function public.set_current_timestamp_updated_at();

create trigger recebimento_tarefas_set_updated_at
before update on public.recebimento_tarefas
for each row
execute function public.set_current_timestamp_updated_at();

create trigger ocorrencias_operacionais_set_updated_at
before update on public.ocorrencias_operacionais
for each row
execute function public.set_current_timestamp_updated_at();

create trigger estoque_set_updated_at
before update on public.estoque
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.current_papel_usuario()
returns public.papel_usuario
language sql
stable
as $$
  select papel
  from public.usuarios
  where id = auth.uid()
    and ativo = true;
$$;

create or replace function public.current_depositante_id()
returns uuid
language sql
stable
as $$
  select depositante_id
  from public.usuarios
  where id = auth.uid()
    and ativo = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_papel_usuario() = 'ADMIN', false);
$$;

create or replace function public.can_access_depositante(target_depositante_id uuid)
returns boolean
language sql
stable
as $$
  select
    coalesce(
      public.is_admin()
      or (
        public.current_depositante_id() is not null
        and public.current_depositante_id() = target_depositante_id
      ),
      false
    );
$$;

alter table public.depositantes enable row level security;
alter table public.usuarios enable row level security;
alter table public.enderecos enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos_recebimento enable row level security;
alter table public.pedidos_recebimento_itens enable row level security;
alter table public.recebimento_tarefas enable row level security;
alter table public.ocorrencias_operacionais enable row level security;
alter table public.documentos_armazenados enable row level security;
alter table public.estoque enable row level security;
alter table public.movimentacoes_estoque enable row level security;

create policy "depositantes_select"
on public.depositantes
for select
to authenticated
using (public.is_admin() or id = public.current_depositante_id());

create policy "depositantes_update"
on public.depositantes
for update
to authenticated
using (public.is_admin() or id = public.current_depositante_id())
with check (public.is_admin() or id = public.current_depositante_id());

create policy "usuarios_select"
on public.usuarios
for select
to authenticated
using (
  public.is_admin()
  or id = auth.uid()
  or (
    depositante_id is not null
    and public.current_depositante_id() = depositante_id
  )
);

create policy "usuarios_insert"
on public.usuarios
for insert
to authenticated
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and depositante_id = public.current_depositante_id()
  )
);

create policy "usuarios_update"
on public.usuarios
for update
to authenticated
using (
  public.is_admin()
  or id = auth.uid()
  or (
    depositante_id is not null
    and depositante_id = public.current_depositante_id()
  )
)
with check (
  public.is_admin()
  or id = auth.uid()
  or (
    depositante_id is not null
    and depositante_id = public.current_depositante_id()
  )
);

create policy "enderecos_select"
on public.enderecos
for select
to authenticated
using (true);

create policy "enderecos_write_admin"
on public.enderecos
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "produtos_access"
on public.produtos
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "pedidos_recebimento_access"
on public.pedidos_recebimento
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "pedidos_recebimento_itens_access"
on public.pedidos_recebimento_itens
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "recebimento_tarefas_access"
on public.recebimento_tarefas
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "ocorrencias_operacionais_access"
on public.ocorrencias_operacionais
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "documentos_armazenados_access"
on public.documentos_armazenados
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "estoque_access"
on public.estoque
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));

create policy "movimentacoes_estoque_access"
on public.movimentacoes_estoque
for all
to authenticated
using (public.can_access_depositante(depositante_id))
with check (public.can_access_depositante(depositante_id));
