-- Checklist pessoal exibido no card "Tarefas" da raiz de Configuracoes --
-- cada usuario ve e conclui somente as tarefas que ele mesmo criou
-- (criado_por), tanto na leitura (src/app/(dashboard)/configuracoes/page.tsx)
-- quanto na conclusao (concluirTarefaAction em tarefas-actions.ts).
--
-- RLS fica ligado sem nenhuma policy -- acesso zero para anon/authenticated
-- por padrao -- porque toda leitura/escrita passa pelo admin client
-- (service_role, que ignora RLS) atras de um requireModuleAccess("configuracoes")
-- no server action/pagina, seguindo o mesmo padrao ja usado pelas outras
-- telas de configuracoes (ver src/app/(dashboard)/configuracoes/enderecos/actions.ts).
create table if not exists public.configuracoes_tarefas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  concluida boolean not null default false,
  criado_por uuid references public.usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists configuracoes_tarefas_pendentes_idx
  on public.configuracoes_tarefas (criado_por, criado_em desc)
  where not concluida;

alter table public.configuracoes_tarefas enable row level security;
