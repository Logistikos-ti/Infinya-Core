-- ============================================================================
-- Módulo Financeiro — Cobrança em tempo real
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela: contratos_cobranca
-- ---------------------------------------------------------------------------
create table if not exists public.contratos_cobranca (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,

  -- Fulfillment
  taxa_fulfillment numeric(6,5) not null default 0.09,
  minimo_fulfillment numeric(10,2) not null default 4.90,

  -- Armazenamento
  tarifa_posicao numeric(10,2) not null default 90.00,

  -- Ponto de coleta
  valor_ponto_coleta numeric(10,2) not null default 1.50,
  marketplaces_ponto_coleta text[] not null default array['shopee', 'mercado livre', 'meli', 'ml'],

  -- Impressão NF
  valor_impressao_nf numeric(10,2) not null default 0.50,

  -- Gestão de frete
  taxa_frete_fixa numeric(10,2) not null default 3.00,
  taxa_frete_percentual numeric(6,5) not null default 0.10,

  -- Recebimento
  tarifa_recebimento numeric(10,2) not null default 0.00,

  -- Software
  valor_software numeric(10,2) not null default 0.00,

  -- Refrigerador
  qtd_refrigeradores integer not null default 0,
  valor_unitario_refrigerador numeric(10,2) not null default 0.00,

  -- Tipo de contrato
  tipo_contrato text not null default 'padrao' check (tipo_contrato in ('padrao', 'consignado')),

  -- Vigência
  vigencia_inicio date,
  vigencia_fim date,
  observacoes text,

  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_contratos_cobranca_depositante unique (depositante_id)
);

create index if not exists idx_contratos_cobranca_depositante
  on public.contratos_cobranca (depositante_id);

-- ---------------------------------------------------------------------------
-- 2. Tabela: faturas
-- ---------------------------------------------------------------------------
create table if not exists public.faturas (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  mes_ano text not null,

  status text not null default 'ABERTA' check (status in (
    'ABERTA', 'FECHADA', 'ENVIADA', 'RECEBIDA'
  )),

  total_servicos numeric(12,2) not null default 0,
  total_descontos numeric(12,2) not null default 0,
  total_a_pagar numeric(12,2) not null default 0,

  boleto_url text,
  boleto_nome text,
  nf_url text,
  nf_nome text,

  fechado_em timestamptz,
  fechado_por uuid references public.usuarios(id),
  enviado_em timestamptz,
  recebido_em timestamptz,

  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_faturas_depositante_mes unique (depositante_id, mes_ano)
);

create index if not exists idx_faturas_depositante on public.faturas (depositante_id);
create index if not exists idx_faturas_mes_ano on public.faturas (mes_ano);
create index if not exists idx_faturas_status on public.faturas (status);

-- ---------------------------------------------------------------------------
-- 3. Tabela: lancamentos
-- ---------------------------------------------------------------------------
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  fatura_id uuid references public.faturas(id) on delete set null,

  mes_ano text not null,

  tipo_servico text not null check (tipo_servico in (
    'FULFILLMENT', 'PONTO_COLETA', 'IMPRESSAO_NF', 'GESTAO_FRETE',
    'RECEBIMENTO', 'ARMAZENAMENTO', 'INSUMO', 'LOGISTICA_REVERSA',
    'SOFTWARE', 'REFRIGERADOR', 'DESCONTO', 'COBRANCA_EXTRA'
  )),

  origem text not null check (origem in (
    'AUTOMATICO', 'MANUAL', 'CRON', 'ESTORNO'
  )),

  referencia_tipo text check (referencia_tipo in (
    'PEDIDO_EXPEDICAO', 'PEDIDO_RECEBIMENTO', 'ROMANEIO', 'SNAPSHOT_ARMAZENAMENTO'
  )),
  referencia_id text,

  descricao text not null,
  quantidade numeric(12,3) not null default 1,
  valor_unitario numeric(12,2) not null,
  valor_total numeric(12,2) not null,

  memoria_calculo jsonb,
  contrato_snapshot jsonb,

  estornado boolean not null default false,
  estorno_de uuid references public.lancamentos(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lancamentos_idempotent
    unique (depositante_id, tipo_servico, referencia_tipo, referencia_id)
);

create index if not exists idx_lancamentos_depositante_mes
  on public.lancamentos (depositante_id, mes_ano);
create index if not exists idx_lancamentos_fatura
  on public.lancamentos (fatura_id);
create index if not exists idx_lancamentos_tipo_servico
  on public.lancamentos (tipo_servico);
create index if not exists idx_lancamentos_referencia
  on public.lancamentos (referencia_tipo, referencia_id);

-- ---------------------------------------------------------------------------
-- 4. Tabela: armazenamento_diario (snapshot para cálculo do pico)
-- ---------------------------------------------------------------------------
create table if not exists public.armazenamento_diario (
  id uuid primary key default gen_random_uuid(),
  depositante_id uuid not null references public.depositantes(id) on delete cascade,
  data date not null,

  qtd_posicoes_ocupadas integer not null default 0,
  detalhamento jsonb,

  created_at timestamptz not null default now(),

  constraint uq_armazenamento_diario_depositante_data
    unique (depositante_id, data)
);

create index if not exists idx_armazenamento_diario_depositante_data
  on public.armazenamento_diario (depositante_id, data desc);

-- ---------------------------------------------------------------------------
-- 5. Tabela: insumos_catalogo
-- ---------------------------------------------------------------------------
create table if not exists public.insumos_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'un',
  preco_unitario numeric(10,2) not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.contratos_cobranca enable row level security;
alter table public.faturas enable row level security;
alter table public.lancamentos enable row level security;
alter table public.armazenamento_diario enable row level security;
alter table public.insumos_catalogo enable row level security;

-- service_role: acesso total
create policy contratos_cobranca_service_all
  on public.contratos_cobranca for all to service_role using (true) with check (true);
create policy faturas_service_all
  on public.faturas for all to service_role using (true) with check (true);
create policy lancamentos_service_all
  on public.lancamentos for all to service_role using (true) with check (true);
create policy armazenamento_diario_service_all
  on public.armazenamento_diario for all to service_role using (true) with check (true);
create policy insumos_catalogo_service_all
  on public.insumos_catalogo for all to service_role using (true) with check (true);

-- authenticated: depositantes veem apenas seus dados
create policy contratos_cobranca_access
  on public.contratos_cobranca for select to authenticated
  using (public.can_access_depositante(depositante_id));

create policy faturas_access
  on public.faturas for select to authenticated
  using (public.can_access_depositante(depositante_id));

create policy lancamentos_access
  on public.lancamentos for select to authenticated
  using (public.can_access_depositante(depositante_id));

create policy armazenamento_diario_access
  on public.armazenamento_diario for select to authenticated
  using (public.can_access_depositante(depositante_id));

create policy insumos_catalogo_access
  on public.insumos_catalogo for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 7. Triggers updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_contratos_cobranca_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_faturas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_lancamentos_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_insumos_catalogo_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_contratos_cobranca_updated_at on public.contratos_cobranca;
create trigger trg_contratos_cobranca_updated_at
  before update on public.contratos_cobranca
  for each row execute function public.set_contratos_cobranca_updated_at();

drop trigger if exists trg_faturas_updated_at on public.faturas;
create trigger trg_faturas_updated_at
  before update on public.faturas
  for each row execute function public.set_faturas_updated_at();

drop trigger if exists trg_lancamentos_updated_at on public.lancamentos;
create trigger trg_lancamentos_updated_at
  before update on public.lancamentos
  for each row execute function public.set_lancamentos_updated_at();

drop trigger if exists trg_insumos_catalogo_updated_at on public.insumos_catalogo;
create trigger trg_insumos_catalogo_updated_at
  before update on public.insumos_catalogo
  for each row execute function public.set_insumos_catalogo_updated_at();

-- ---------------------------------------------------------------------------
-- 8. View consolidada de lancamentos por depositante/mes/tipo
-- ---------------------------------------------------------------------------
create or replace view public.lancamentos_consolidado as
select
  depositante_id,
  mes_ano,
  tipo_servico,
  count(*)::integer as qtd,
  sum(valor_total) as total
from public.lancamentos
where estornado = false
group by depositante_id, mes_ano, tipo_servico;

-- ---------------------------------------------------------------------------
-- 9. Função: garantir_ou_criar_fatura
-- Retorna o ID da fatura para um depositante/mes, criando se não existir.
-- ---------------------------------------------------------------------------
create or replace function public.garantir_ou_criar_fatura(
  p_depositante_id uuid,
  p_mes_ano text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fatura_id uuid;
begin
  select id into v_fatura_id
  from public.faturas
  where depositante_id = p_depositante_id
    and mes_ano = p_mes_ano;

  if found then
    return v_fatura_id;
  end if;

  insert into public.faturas (depositante_id, mes_ano, status)
  values (p_depositante_id, p_mes_ano, 'ABERTA')
  on conflict (depositante_id, mes_ano) do nothing
  returning id into v_fatura_id;

  if v_fatura_id is null then
    select id into v_fatura_id
    from public.faturas
    where depositante_id = p_depositante_id
      and mes_ano = p_mes_ano;
  end if;

  return v_fatura_id;
end;
$$;

revoke all on function public.garantir_ou_criar_fatura(uuid, text) from anon, authenticated;
grant execute on function public.garantir_ou_criar_fatura(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Função: recalcular_totais_fatura
-- Recalcula os totais de uma fatura a partir dos lancamentos.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_totais_fatura(p_fatura_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicos numeric;
  v_descontos numeric;
begin
  select
    coalesce(sum(case when tipo_servico <> 'DESCONTO' then valor_total else 0 end), 0),
    coalesce(sum(case when tipo_servico = 'DESCONTO' then abs(valor_total) else 0 end), 0)
  into v_servicos, v_descontos
  from public.lancamentos
  where fatura_id = p_fatura_id
    and estornado = false;

  update public.faturas
  set
    total_servicos = v_servicos,
    total_descontos = v_descontos,
    total_a_pagar = greatest(0, v_servicos - v_descontos)
  where id = p_fatura_id;
end;
$$;

revoke all on function public.recalcular_totais_fatura(uuid) from anon, authenticated;
grant execute on function public.recalcular_totais_fatura(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 11. Função: snapshot_armazenamento_diario
-- Registra a ocupação de posições por depositante para a data informada.
-- ---------------------------------------------------------------------------
create or replace function public.snapshot_armazenamento_diario(p_data date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.armazenamento_diario (depositante_id, data, qtd_posicoes_ocupadas, detalhamento)
  select
    e.depositante_id,
    p_data,
    count(distinct e.endereco_id)::integer,
    jsonb_build_object(
      'por_area', (
        select jsonb_object_agg(sub.area, sub.cnt)
        from (
          select en.area::text as area, count(distinct e2.endereco_id)::integer as cnt
          from public.estoque e2
          join public.enderecos en on en.id = e2.endereco_id
          where e2.depositante_id = e.depositante_id
            and e2.quantidade > 0
          group by en.area
        ) sub
      )
    )
  from public.estoque e
  where e.quantidade > 0
  group by e.depositante_id
  on conflict (depositante_id, data) do update
    set qtd_posicoes_ocupadas = excluded.qtd_posicoes_ocupadas,
        detalhamento = excluded.detalhamento
  returning 1 into v_count;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.snapshot_armazenamento_diario(date) from anon, authenticated;
grant execute on function public.snapshot_armazenamento_diario(date) to service_role;
