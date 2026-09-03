-- Agendamento de inventário: hoje, tanto a contagem cíclica quanto o
-- inventário geral iniciam a contagem no exato instante em que são criados
-- (iniciado_em é gravado no mesmo insert do header, sem estágio intermediário).
-- Esta migração adiciona um estágio "programado" real para as duas tabelas:
-- data futura + responsável pré-atribuído, antes de qualquer contagem
-- começar. A varredura de saldo/snapshot de produtos continua acontecendo só
-- na hora de INICIAR (não na hora de programar), pra não guardar um
-- retrato de estoque que fica velho entre o agendamento e o início real.

-- contagens_estoque.status já é o enum status_contagem_estoque, que
-- declarava EM_CONTAGEM/CANCELADA sem nenhum código usá-los -- só falta o
-- valor novo.
alter type public.status_contagem_estoque add value if not exists 'PROGRAMADA';

alter table public.contagens_estoque
  add column if not exists programado_para timestamptz,
  add column if not exists responsavel_id uuid references public.usuarios (id) on delete set null;

-- inventarios_gerais.status é texto com CHECK (não é enum) -- precisa trocar
-- a constraint pra aceitar o valor novo.
alter table public.inventarios_gerais
  add column if not exists programado_para timestamptz,
  add column if not exists responsavel_id uuid references public.usuarios (id) on delete set null;

alter table public.inventarios_gerais drop constraint if exists inventarios_gerais_status_check;
alter table public.inventarios_gerais
  add constraint inventarios_gerais_status_check
  check (status in ('PROGRAMADO', 'EM_CONTAGEM', 'CONCLUIDO', 'CANCELADO'));
