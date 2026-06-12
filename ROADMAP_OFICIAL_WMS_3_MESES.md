# Roadmap Oficial WMS Evolveg

Baseado no documento [PlanoAcao_WMS_Evolveg_3Meses.pdf](/C:/Users/admin/OneDrive/Desktop/Claude/Projects%20&%20Softwares/Our%20WMS/PlanoAcao_WMS_Evolveg_3Meses.pdf).

## Diretriz principal

Seguiremos o cronograma original de 3 meses:

1. Mês 1: fundação, cadastros, recebimento e estoque base
2. Mês 2: expedição, Bling V3, marketplaces e romaneio
3. Mês 3: estoque avançado, dashboard, NF-e, migração e go-live

## Mês 1 — Fundação + Recebimento

### Semana 1 — Fundação

- Repositório e estrutura Next.js
- Supabase, autenticação e storage
- Schema inicial de banco
- RLS multi-tenant
- Login, logout e RBAC
- Setup visual base do app

### Semana 2 — Cadastros

- CRUD de depositantes
- CRUD de produtos
- Importação de produtos via Excel
- Endereçamento do armazém
- Gestão de usuários e permissões
- Sidebar e layout responsivo

### Semana 3 — Recebimento

- Pedido de recebimento manual
- Importação de NF-e XML
- Consulta com filtros
- Tela operacional de conferência
- Divergências com alerta
- Protocolo com lote e validade
- Entrada automática no estoque

### Semana 4 — Estoque Base

- Consulta de estoque
- Alerta de vencimento
- Relatório exportável
- Testes end-to-end do inbound
- Homologação e revisão de bugs

## Mês 2 — Expedição / Outbound

### Semana 5 — Integração Bling

- OAuth2 e webhook
- Fila assíncrona de pedidos
- Mapeamento de marketplaces
- Criação automática de pedidos
- Painel de integrações

### Semana 6 — Pedido de Expedição

- Cadastro manual
- Consulta com filtros avançados
- Importação de NF-e de saída
- Fluxo de status completo
- Integração com etiquetas e rastreamento

### Semana 7 — Separação e Conferência

- Picking list por operador
- Leitura de código de barras
- Conferência item a item
- Alerta de divergência
- Gestão de insumos
- Geração de etiqueta

### Semana 8 — Romaneio e Transportadoras

- Cadastro de transportadoras
- Cadastro de rotas
- Geração de romaneio
- Impressão em PDF
- Testes end-to-end do outbound

## Mês 3 — Estoque Avançado + Dashboard + Go-live

### Semana 9 — Estoque Avançado

- Movimentação interna
- Fracionamento
- Reclassificação
- Inventário
- Mínimo e máximo por produto
- Bloqueio de lotes

### Semana 10 — Dashboard e Relatórios

- KPIs em tempo real
- Integração com módulo financeiro
- Rastreabilidade de NF de entrada e saída
- Produtividade por operador
- SLA de expedição
- Exportação Excel/PDF

### Semana 11 — NF-e + Ajustes Finais

- Consulta fiscal completa
- Relatório por depositante e período
- Protocolos de depósito
- Ajustes de UX/UI
- Testes de carga
- Treinamento da equipe

### Semana 12 — Go-live

- Migração de dados do SmartGo
- Operação paralela
- Go-live oficial
- Monitoramento assistido
- Documentação operacional

## Regra de execução daqui para frente

Enquanto estivermos no Mês 1, a prioridade de implementação será:

1. concluir fundação técnica pendente
2. concluir cadastros reais com persistência
3. concluir recebimento real com banco
4. concluir estoque base real

Não vamos puxar como prioridade principal:

- portal do depositante
- app mobile
- BI avançado
- features de fases 4, 5 e 6

Esses itens continuam no roadmap, mas entram somente após o go-live do core operacional.
