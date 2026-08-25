create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  ocorrido_em timestamptz not null default now(),
  depositante_id uuid references public.depositantes(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nome text,
  usuario_papel text,
  modulo text not null,
  acao text not null,
  entidade_tipo text not null,
  entidade_id text,
  resultado text not null default 'SUCESSO'
    check (resultado in ('SUCESSO', 'ERRO', 'NEGADO')),
  origem text not null default 'BANCO'
    check (origem in ('BANCO', 'APLICACAO', 'AUTENTICACAO', 'INTEGRACAO', 'SISTEMA')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  metadados jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  request_id text
);

comment on table public.auditoria_eventos is
  'Trilha central, imutavel e restrita das alteracoes e eventos relevantes do WMS.';

create index if not exists auditoria_eventos_ocorrido_em_idx
  on public.auditoria_eventos (ocorrido_em desc);
create index if not exists auditoria_eventos_depositante_idx
  on public.auditoria_eventos (depositante_id, ocorrido_em desc);
create index if not exists auditoria_eventos_usuario_idx
  on public.auditoria_eventos (usuario_id, ocorrido_em desc);
create index if not exists auditoria_eventos_modulo_acao_idx
  on public.auditoria_eventos (modulo, acao, ocorrido_em desc);
create index if not exists auditoria_eventos_entidade_idx
  on public.auditoria_eventos (entidade_tipo, entidade_id, ocorrido_em desc);

alter table public.auditoria_eventos enable row level security;

drop policy if exists auditoria_eventos_select_admin_ti on public.auditoria_eventos;
create policy auditoria_eventos_select_admin_ti
  on public.auditoria_eventos
  for select
  to authenticated
  using (coalesce(public.current_papel_usuario()::text in ('ADMIN', 'TI'), false));

revoke insert, update, delete on public.auditoria_eventos from anon, authenticated;
grant select on public.auditoria_eventos to authenticated;

create or replace function public.sanitizar_auditoria_jsonb(valor jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  resultado jsonb;
begin
  if valor is null then
    return null;
  end if;

  case jsonb_typeof(valor)
    when 'object' then
      select coalesce(
        jsonb_object_agg(
          chave,
          case
            when lower(chave) = any (array[
              'access_token', 'refresh_token', 'client_secret', 'password', 'senha',
              'token', 'authorization', 'xml_conteudo', 'conteudo', 'arquivo_base64',
              'dados_criptografados', 'service_role_key'
            ]) then '"[REDACTED]"'::jsonb
            else public.sanitizar_auditoria_jsonb(item)
          end
        ),
        '{}'::jsonb
      )
      into resultado
      from jsonb_each(valor) as entrada(chave, item);
      return resultado;
    when 'array' then
      select coalesce(jsonb_agg(public.sanitizar_auditoria_jsonb(item)), '[]'::jsonb)
      into resultado
      from jsonb_array_elements(valor) as entrada(item);
      return resultado;
    else
      return valor;
  end case;
end;
$$;

create or replace function public.impedir_alteracao_auditoria()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
     or current_setting('app.audit_maintenance', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'Os registros da trilha de auditoria sao imutaveis.';
end;
$$;

drop trigger if exists auditoria_eventos_imutavel on public.auditoria_eventos;
create trigger auditoria_eventos_imutavel
  before update or delete on public.auditoria_eventos
  for each row execute function public.impedir_alteracao_auditoria();

create or replace function public.registrar_auditoria_tabela()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  anterior jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  novo jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  base jsonb := coalesce(novo, anterior, '{}'::jsonb);
  usuario_uuid uuid;
  usuario_texto text;
  usuario_registro record;
  depositante_uuid uuid;
  entidade_texto text;
  acao_texto text;
begin
  if tg_op = 'UPDATE'
     and (anterior - 'updated_at' - 'atualizado_em' - 'ultimo_acesso_em')
       = (novo - 'updated_at' - 'atualizado_em' - 'ultimo_acesso_em') then
    return new;
  end if;

  usuario_texto := coalesce(
    auth.uid()::text,
    novo->>'atualizado_por',
    novo->>'criado_por',
    novo->>'operador_id',
    novo->>'conferido_por',
    novo->>'contado_por',
    novo->>'enviado_por',
    novo->>'resolvido_por',
    anterior->>'atualizado_por',
    anterior->>'criado_por',
    anterior->>'operador_id',
    anterior->>'conferido_por',
    anterior->>'contado_por',
    anterior->>'enviado_por',
    anterior->>'resolvido_por',
    case when tg_table_name = 'usuarios' then base->>'id' end
  );

  if usuario_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    usuario_uuid := usuario_texto::uuid;
  end if;

  if usuario_uuid is not null then
    select id, nome, papel::text
      into usuario_registro
      from public.usuarios
     where id = usuario_uuid;
  end if;

  if coalesce(base->>'depositante_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    depositante_uuid := (base->>'depositante_id')::uuid;
  end if;

  entidade_texto := coalesce(base->>'id', base->>'codigo', base->>'numero', base->>'chave');
  acao_texto := case tg_op
    when 'INSERT' then 'CRIAR'
    when 'UPDATE' then 'ATUALIZAR'
    when 'DELETE' then 'EXCLUIR'
  end;

  insert into public.auditoria_eventos (
    depositante_id,
    usuario_id,
    usuario_nome,
    usuario_papel,
    modulo,
    acao,
    entidade_tipo,
    entidade_id,
    resultado,
    origem,
    dados_anteriores,
    dados_novos,
    metadados
  ) values (
    depositante_uuid,
    usuario_registro.id,
    usuario_registro.nome,
    usuario_registro.papel,
    coalesce(nullif(tg_argv[0], ''), 'SISTEMA'),
    acao_texto,
    tg_table_name,
    entidade_texto,
    'SUCESSO',
    'BANCO',
    public.sanitizar_auditoria_jsonb(anterior),
    public.sanitizar_auditoria_jsonb(novo),
    jsonb_build_object('schema', tg_table_schema, 'operacao_banco', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  item record;
  nome_trigger text;
begin
  for item in
    select * from (values
      ('depositantes', 'CADASTROS'),
      ('usuarios', 'ACESSOS'),
      ('produtos', 'PRODUTOS'),
      ('produto_kit_componentes', 'PRODUTOS'),
      ('produto_kit_comercial_regras', 'PRODUTOS'),
      ('enderecos', 'ENDERECAMENTO'),
      ('transportadoras', 'TRANSPORTADORAS'),
      ('pedidos_recebimento', 'RECEBIMENTO'),
      ('pedidos_recebimento_itens', 'RECEBIMENTO'),
      ('recebimento_tarefas', 'RECEBIMENTO'),
      ('ocorrencias_operacionais', 'OPERACAO'),
      ('documentos_armazenados', 'DOCUMENTOS'),
      ('estoque', 'ESTOQUE'),
      ('movimentacoes_estoque', 'ESTOQUE'),
      ('contagens_estoque', 'INVENTARIO'),
      ('contagens_estoque_itens', 'INVENTARIO'),
      ('inventarios_gerais', 'INVENTARIO'),
      ('inventarios_gerais_itens', 'INVENTARIO'),
      ('inventarios_gerais_participantes', 'INVENTARIO'),
      ('estoque_quarentena', 'QUARENTENA'),
      ('pedidos_expedicao', 'EXPEDICAO'),
      ('pedidos_expedicao_itens', 'EXPEDICAO'),
      ('ondas_separacao', 'SEPARACAO'),
      ('ondas_separacao_pedidos', 'SEPARACAO'),
      ('bipagens_separacao', 'SEPARACAO'),
      ('romaneios_carga', 'ROMANEIO'),
      ('romaneios_carga_pedidos', 'ROMANEIO'),
      ('remessas_full', 'PEDIDOS_FULL'),
      ('remessas_full_itens', 'PEDIDOS_FULL'),
      ('remessas_full_documentos', 'PEDIDOS_FULL'),
      ('suporte_chamados', 'SUPORTE'),
      ('suporte_comentarios', 'SUPORTE'),
      ('contratos_cobranca', 'FINANCEIRO'),
      ('faturas', 'FINANCEIRO'),
      ('lancamentos', 'FINANCEIRO'),
      ('insumos_catalogo', 'FINANCEIRO')
    ) as tabelas(nome, modulo)
  loop
    if to_regclass(format('public.%I', item.nome)) is not null then
      nome_trigger := left('auditoria_' || item.nome, 63);
      execute format('drop trigger if exists %I on public.%I', nome_trigger, item.nome);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria_tabela(%L)',
        nome_trigger,
        item.nome,
        item.modulo
      );
    end if;
  end loop;
end;
$$;
