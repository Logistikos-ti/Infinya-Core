-- Recebimento hoje não tem onde guardar doca, transportadora nem quem
-- conferiu: doca vivia só como texto solto no título de uma tarefa
-- (recebimento_tarefas), transportadora só em observações (sem convenção
-- consistente) e ninguém gravava quem fez a conferência. `recebido_em` já
-- existia na tabela mas nunca era escrito por nenhum fluxo do código.
--
-- doca            -- atribuída manualmente na lista (popup de seleção),
--                    editável a qualquer momento (nula até ser atribuída).
-- transportadora  -- informada na abertura do pedido, quando houver.
-- conferido_por   -- gravado automaticamente no primeiro PATCH de
--                    conferência salvo pro pedido (junto com recebido_em),
--                    não é campo editável manualmente.
alter table public.pedidos_recebimento
  add column if not exists doca text,
  add column if not exists transportadora text,
  add column if not exists conferido_por uuid references public.usuarios (id) on delete set null;
