# Catálogo e Solicitação de Presentes

Ferramenta interna da área de Relacionamento da AUVP. O consultor escolhe o
cliente, o presente e escreve a carta que acompanha o envio; quem gerencia
acompanha aprovação, compra, envio, entrega e custo por consultor.

O documento de origem está em
[`catalogo-presentes-spec-v1.md`](catalogo-presentes-spec-v1.md).

## Estado atual

O V1 está de pé de ponta a ponta: o consultor pede, o Admin move o status, o
Financeiro compra e a expedição recebe o pedido pronto. Falta a TI publicar e
ligar o secret do client no Keycloak da AUVP, ver
[entrega para a TI](docs/10-entrega-ti.md).

| Área                                           | Situação                                       |
| ---------------------------------------------- | ---------------------------------------------- |
| Modelo de dados e migrations                   | pronto, com restrições de integridade no banco |
| Permissões por perfil                          | pronto e testado                               |
| Fluxo de status                                | pronto e testado                               |
| Saldo mensal por consultor                     | pronto e testado                               |
| Exportação CSV/XLSX                            | pronto e testado                               |
| Autenticação SSO (OIDC), com saída no Keycloak | pronto, aguardando o secret do client          |
| Catálogo, gestão, fila de compras, listagens   | telas prontas                                  |
| Formulário de solicitação                      | pronto, em cinco etapas                        |
| Mudança de status, com motivo e histórico      | pronto, individual e em lote                   |
| Rastreio preenchido e visível ao consultor     | pronto, pelo caminho manual                    |
| Catálogo de presentes                          | os 49 da planilha da área, com foto            |
| Fila da expedição, com CSV e XLSX              | pronto - substitui a planilha feita à mão      |
| CRUD de produto, cliente e usuário             | pronto, com foto e importação por CSV          |
| Tiny ERP e Salesforce                          | fase 2, contratos já fixados                   |

## Como rodar

Requisitos: Node 20.11+ e um Postgres 16 (Docker, instalado ou portátil, ver
[ambiente local](docs/06-ambiente-local.md)). Para publicar em produção, a TI
segue a [entrega para a TI](docs/10-entrega-ti.md).

```bash
cp .env.example .env      # ajuste o que precisar
docker compose up -d      # sobe o Postgres
npm install
npm run db:migrate        # cria o schema
npm run db:seed           # carrega dados de exemplo
npm run dev
```

A aplicação sobe em <http://localhost:3000>.

Sem SSO configurado, ligue `AUTH_DEV_BYPASS="true"` no `.env` para entrar
informando um e-mail. Para entrar como Admin, coloque o mesmo e-mail em
`BOOTSTRAP_ADMIN_EMAILS`. O bypass é recusado fora de `NODE_ENV=development`.

## Comandos

| Comando               | O que faz                                       |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | servidor de desenvolvimento                     |
| `npm run build`       | build de produção                               |
| `npm run check`       | formato, lint, tipos e testes - o que a CI roda |
| `npm test`            | testes das regras de negócio                    |
| `npm run db:migrate`  | cria/aplica migrations em desenvolvimento       |
| `npm run db:seed`     | popula com dados de exemplo (idempotente)       |
| `npm run db:catalogo` | carrega só o catálogo real, para produção       |
| `npm run db:studio`   | interface visual do banco                       |
| `npm run demo:build`  | compila o CSS da vitrine estática               |

## Estrutura

```
src/
  app/                    telas e rotas (App Router)
    catalogo/             catálogo do consultor
    solicitacoes/         lista e formulário de solicitação
    financeiro/compras/   fila de compras do Financeiro
    admin/                gestão, catálogo, clientes, usuários
    api/                  auth, consulta de CEP, exportação
  components/             UI compartilhada (shadcn/ui do DS AUVP)
  styles/                 tokens do Design System AUVP
  lib/
    permissions.ts        matriz de permissões, fonte única
    status.ts             máquina de estados do fluxo
    saldo.ts              apuração do gasto mensal
    compras.ts            fila de compras do Financeiro
    money.ts              aritmética monetária em Decimal
    export/               geração de CSV e XLSX
    providers/            camada trocável de catálogo e clientes
    validators/           schemas Zod dos formulários
prisma/                   schema, migrations e seed
demo/                     vitrine estática publicada no GitHub Pages
docs/                     documentação de decisões e operação
```

## Documentação

- [Modelo de dados](docs/01-modelo-de-dados.md)
- [Perfis e permissões](docs/02-perfis-e-permissoes.md)
- [Fluxo de status](docs/03-fluxo-de-status.md)
- [Integrações da fase 2](docs/04-integracoes-fase-2.md)
- [Perguntas em aberto](docs/05-perguntas-em-aberto.md)
- [Ambiente local](docs/06-ambiente-local.md)
- [Deploy](docs/07-deploy.md)
- [Identidade visual](docs/08-identidade-visual.md)
- [Checklist de lançamento](docs/09-checklist-de-lancamento.md)
- [Entrega para a TI](docs/10-entrega-ti.md)
- [Produção na Vercel](docs/12-producao-vercel.md)
- [Integração com o Tiny](docs/13-tiny.md)
- [Logística](docs/11-logistica.md)
- [Decisões de arquitetura](docs/adr/)

## Onde isso roda

**Aplicação:** produção na Vercel, publicada a cada commit no `main`
([produção na Vercel](docs/12-producao-vercel.md)). A imagem Docker para a
infraestrutura da TI continua pronta como alternativa
([entrega para a TI](docs/10-entrega-ti.md)).

**Vitrine:** GitHub Pages, a partir de `demo/`. É uma demonstração navegável
com dados fictícios, sem login e sem banco, feita para mostrar as telas a quem
aprova o V1. A aplicação real não roda no Pages: ela precisa de servidor.
