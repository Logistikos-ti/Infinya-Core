-- snapshot_armazenamento_diario quebrava com "query returned more than one
-- row" (P0003) sempre que havia mais de um depositante com estoque > 0,
-- porque o INSERT ... SELECT ... GROUP BY (uma linha por depositante) usava
-- RETURNING 1 INTO v_count. Como o cron que chama essa função (via
-- registrarSnapshotArmazenamento em billing.ts) ignorava o campo `error` do
-- retorno do RPC, a falha nunca apareceu em lugar nenhum — a tabela
-- armazenamento_diario ficou vazia desde a criação do módulo financeiro, e
-- por isso nenhum depositante foi cobrado de armazenamento em nenhuma
-- fatura até agora. Troca RETURNING ... INTO por GET DIAGNOSTICS ROW_COUNT,
-- que lida corretamente com múltiplas linhas afetadas.
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
        detalhamento = excluded.detalhamento;

  get diagnostics v_count = row_count;

  return coalesce(v_count, 0);
end;
$$;

-- Fecha também o gap de segurança já conhecido nessa função (ver memória
-- rpc-grant-verification): revoke ... from anon, authenticated nunca
-- revogou de PUBLIC, então a anon key ainda conseguia chamar esse RPC
-- security-definer sem autenticação via PostgREST.
revoke all on function public.snapshot_armazenamento_diario(date) from public, anon, authenticated;
grant execute on function public.snapshot_armazenamento_diario(date) to service_role;
