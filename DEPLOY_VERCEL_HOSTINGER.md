# Deploy Vercel + Domínio infinoos.com.br

Guia de publicação do Infinoos WMS usando:

- GitHub para versionamento
- Vercel para execução do Next.js
- DNS do domínio `infinoos.com.br` apontando para a Vercel

## Repositório

Repositório oficial:

- `https://github.com/Logistikos-ti/Infinya-Core`

## Domínio ativo

- **Domínio final:** `wms.infinoos.com.br`
- **Domínio anterior (a ser desativado):** `wms.logistikos.com.br`

O código não tem nenhuma URL de domínio fixa no código-fonte — tudo é resolvido a partir da
variável de ambiente `NEXT_PUBLIC_APP_URL` (ver `src/lib/env.ts`). Trocar de domínio é uma
questão de configuração (Vercel + DNS + apps externos), sem precisar alterar a aplicação.

## Checklist de migração (nesta ordem)

1. **Vercel → adicionar o novo domínio**
   - Abra o projeto na Vercel
   - `Settings > Domains`
   - Adicione `wms.infinoos.com.br`
   - A Vercel vai mostrar o registro DNS exato a criar (normalmente um `CNAME` apontando para
     `cname.vercel-dns.com`, mas siga o valor exibido na tela — pode variar)

2. **DNS do domínio `infinoos.com.br`**
   - Entre no painel de DNS de onde o domínio está registrado (se for na Hostinger, é em
     `Domínios > infinoos.com.br > DNS / Nameservers`)
   - Crie o registro exatamente como a Vercel indicou no passo 1 (tipo, nome/host `wms` e valor)
   - Aguarde a propagação (costuma levar de alguns minutos a poucas horas)
   - Volte em `Settings > Domains` na Vercel e confirme que o domínio ficou com o status
     **Valid** — a Vercel emite o SSL automaticamente depois disso

3. **Atualizar a variável de ambiente na Vercel**
   - `Settings > Environment Variables`
   - Atualize `NEXT_PUBLIC_APP_URL` para:
     ```
     NEXT_PUBLIC_APP_URL=https://wms.infinoos.com.br
     ```
   - Redeploy o projeto (a Vercel pede um novo deploy para aplicar variáveis alteradas)

4. **Atualizar o app do Bling (painel de desenvolvedor do Bling)**
   - O código gera essas URLs automaticamente a partir de `NEXT_PUBLIC_APP_URL`, mas o Bling
     exige que a URL de callback esteja **cadastrada manualmente** no app OAuth — se não
     atualizar lá, o login OAuth quebra.
   - Callback OAuth:
     ```
     https://wms.infinoos.com.br/api/integracoes/bling/oauth/callback
     ```
   - Webhook:
     ```
     https://wms.infinoos.com.br/api/integracoes/bling/webhook
     ```
   - Escopo mínimo: `Pedido de venda`
   - Eventos do webhook: `created`, `updated`, `deleted`

5. **Atualizar o app do Mercado Livre (se a integração de ML já estiver ativa)**
   - Mesma lógica: a URL é gerada pelo código, mas o app cadastrado na plataforma de
     desenvolvedores do Mercado Livre precisa da URL de callback atualizada manualmente:
     ```
     https://wms.infinoos.com.br/api/integracoes/mercado-livre/oauth/callback
     ```

6. **Validar o ambiente publicado**
   - Acesse `https://wms.infinoos.com.br` e confirme login, dashboard e um fluxo simples
     (ex.: consulta de endereços)
   - Teste uma sincronização do Bling para confirmar que o OAuth/webhook novo está funcionando

7. **Desativar o domínio antigo**
   - Depois de validar que tudo funciona no novo domínio, remova `wms.logistikos.com.br` em
     `Settings > Domains` na Vercel
   - Remova o registro DNS correspondente em `logistikos.com.br`, se não for mais usado para
     outra coisa

## Variáveis de ambiente completas na Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL=https://wms.infinoos.com.br`
- `BLING_CLIENT_ID`
- `BLING_CLIENT_SECRET`

## Fluxo de deploy (sem mudanças)

1. Alterar localmente
2. Subir para o GitHub
3. Vercel faz deploy automático
4. Validar o ambiente publicado
