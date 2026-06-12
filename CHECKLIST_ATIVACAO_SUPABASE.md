# Checklist de Ativacao Supabase

Este arquivo resume a ordem pratica para ligar a base remota do WMS no projeto `fsdndzzxmqvdttfpsant`.

## 1. SQL inicial

Executar nesta ordem:

1. `supabase/migrations/20260610183000_mes1_fundacao_recebimento.sql`
2. `supabase/seed.sql`
3. `supabase/seed_enderecos.sql`
4. Opcional para dev: `supabase/seed_demo_operacao.sql`

## 2. Usuario admin

1. Criar o usuario manualmente em `Authentication > Users`
2. Copiar o `UUID` do usuario criado
3. Abrir `supabase/bootstrap_admin.sql`
4. Substituir:
   - `{{AUTH_USER_ID}}`
   - `{{ADMIN_EMAIL}}`
   - `{{ADMIN_NOME}}`
5. Executar o script

## 3. Validacao funcional

1. Confirmar que existe registro em `public.usuarios`
2. Confirmar que `papel = ADMIN`
3. Abrir o app local
4. Fazer login em `/login`
5. Verificar:
   - acesso a `/dashboard`
   - logout funcionando
   - bloqueio das rotas privadas sem sessao

## 4. Tabelas mais importantes para checagem

- `public.depositantes`
- `public.usuarios`
- `public.enderecos`
- `public.produtos`
- `public.pedidos_recebimento`
- `public.pedidos_recebimento_itens`
- `public.recebimento_tarefas`
- `public.estoque`

## 5. Proxima virada apos ativacao

1. Trocar o `POST /api/recebimento` de modo mock para persistencia real
2. Persistir cadastros de configuracoes no banco
3. Ligar dashboard e modulo de recebimento aos selects reais
4. Iniciar expedicao e picking sobre a mesma camada
