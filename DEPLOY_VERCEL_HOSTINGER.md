# Deploy Vercel + Hostinger

Guia de publicação do Infinya ? Log usando:

- GitHub para versionamento
- Vercel para execução do Next.js
- Hostinger para gestão do domínio e DNS

## Repositório

Repositório oficial:

- `https://github.com/Logistikos-ti/Infinya-Core`

## Projeto na Vercel

1. Acesse a Vercel
2. Clique em `Add New Project`
3. Importe o repositório `Logistikos-ti/Infinya-Core`
4. Framework:
   - `Next.js`
5. Root directory:
   - padrão, se o projeto estiver na raiz
6. Build e output:
   - usar os padrões detectados pela Vercel

## Variáveis de ambiente

Cadastrar na Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `BLING_CLIENT_ID`
- `BLING_CLIENT_SECRET`

Valor esperado para:

- `NEXT_PUBLIC_APP_URL=https://wms.logistikos.com.br`

## Domínio

Domínio inicial:

- `wms.logistikos.com.br`

Na Vercel:

1. Abra o projeto
2. Vá em `Settings > Domains`
3. Adicione:
   - `wms.logistikos.com.br`

A Vercel vai informar os registros DNS necessários.

## DNS na Hostinger

Na Hostinger:

1. Abrir a zona DNS de `logistikos.com.br`
2. Criar os registros informados pela Vercel
3. Aguardar a propagação

Observação:

- o DNS fica na Hostinger
- a aplicação fica hospedada na Vercel
- o SSL é emitido automaticamente pela Vercel

## URLs finais do Bling

Após o domínio ficar ativo:

### Callback OAuth

`https://wms.logistikos.com.br/api/integracoes/bling/oauth/callback`

### Webhook

`https://wms.logistikos.com.br/api/integracoes/bling/webhook`

### Escopo mínimo

- `Pedido de venda`

### Eventos do webhook

- `created`
- `updated`
- `deleted`

## Fluxo de deploy

Modelo recomendado:

1. alterar localmente
2. subir para o GitHub
3. Vercel faz deploy automático
4. validar o ambiente publicado

## Evolução futura

Quando a marca Infinya estiver pronta, trocar:

- `wms.logistikos.com.br`

por:

- domínio oficial da Infinya

Sem necessidade de mudar a arquitetura da aplicação.
