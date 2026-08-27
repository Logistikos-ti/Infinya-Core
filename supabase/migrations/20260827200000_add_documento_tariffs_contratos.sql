alter table public.contratos_cobranca
  add column if not exists valor_carta_correcao numeric(10,2) not null default 0,
  add column if not exists valor_outro_documento numeric(10,2) not null default 0;
