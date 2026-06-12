# Infinya Core

Base inicial do WMS proprietário da Infinya para operações logísticas multi-depositante.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase

## Primeiros comandos

```bash
npm install
npm run dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Fundação do mês 1

Já deixamos preparada a base para iniciar o módulo de fundação + recebimento:

- autenticação com Supabase Auth
- middleware de sessão
- contexto do usuário no layout
- logout e redirecionamento automático de sessão no login
- papel `TI` previsto como acesso administrativo interno
- migration inicial com depositantes, usuários, produtos, endereços, recebimento e estoque
- RLS por depositante com exceção administrativa
- seed inicial dos depositantes da operação

## Estrutura Supabase

Os arquivos principais ficam em:

- `supabase/config.toml`
- `supabase/migrations/20260610183000_mes1_fundacao_recebimento.sql`
- `supabase/seed.sql`
- `supabase/seed_enderecos.sql`
- `supabase/seed_demo_operacao.sql`
- `supabase/bootstrap_admin.sql`
- `CHECKLIST_ATIVACAO_SUPABASE.md`

## Ordem recomendada de ativação

1. Aplicar `supabase/migrations/20260610183000_mes1_fundacao_recebimento.sql`
2. Aplicar `supabase/seed.sql`
3. Aplicar `supabase/seed_enderecos.sql`
4. Opcional: aplicar `supabase/seed_demo_operacao.sql` para ambiente de desenvolvimento
5. Criar o primeiro usuário no Auth do Supabase
6. Rodar `supabase/bootstrap_admin.sql` preenchendo os placeholders
7. Fazer login em `/login`

## O que já existe no app

- dashboard executivo com roadmap e fila de recebimento
- painel de recebimento
- rota de novo recebimento
- rota de detalhe do recebimento
- cadastros base de configurações
- endpoints internos em `src/app/api/*`
- subrotas de API para `dashboard`, `recebimento`, `configuracoes`, `estoque`, `expedicao`, `romaneio`, `nfe` e `relatorios`
- endpoint de saúde em `/api/health`

## Rotas de API internas

- `/api/health`
- `/api/dashboard`
- `/api/recebimento`
- `/api/recebimento/[id]`
- `/api/configuracoes`
- `/api/configuracoes/depositantes`
- `/api/configuracoes/usuarios`
- `/api/configuracoes/produtos`
- `/api/configuracoes/enderecos`
- `/api/estoque`
- `/api/expedicao`
- `/api/romaneio`
- `/api/nfe`
- `/api/relatorios`

## Próxima etapa

1. Aplicar a base no projeto Supabase remoto
2. Criar o admin inicial e validar login real
3. Persistir recebimento e cadastros no banco
4. Evoluir expedição, picking e integrações
