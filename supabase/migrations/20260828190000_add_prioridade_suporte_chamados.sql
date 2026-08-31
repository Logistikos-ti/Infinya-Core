-- Adiciona prioridade aos chamados de depositantes. O depositante escolhe ao
-- abrir (default "Normal") e a equipe interna pode reclassificar. Valores
-- validados por check constraint, espelhando os rótulos exibidos na tela.
alter table public.suporte_chamados
  add column if not exists prioridade text not null default 'Normal'
    check (prioridade in ('Baixa', 'Normal', 'Alta', 'Crítica'));
