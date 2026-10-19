# Deploy

> **A produção roda na Vercel**, a cada commit no `main`:
> [produção na Vercel](12-producao-vercel.md).
>
> A imagem Docker para a infraestrutura da TI, em
> `catalogo-relacionamento.prod.auvp.net`, continua pronta como alternativa:
> [entrega para a TI](10-entrega-ti.md). O caminho pelo Railway abaixo também.

Dois destinos, com propósitos diferentes.

|                | Aplicação          | Vitrine                       |
| -------------- | ------------------ | ----------------------------- |
| Onde           | Railway            | GitHub Pages                  |
| O que é        | o sistema real     | demonstração navegável        |
| Dados          | Postgres           | fictícios, no próprio arquivo |
| Login          | SSO da AUVP        | nenhum                        |
| Publica quando | manual ou por push | push em `demo/`               |

**A aplicação não roda no GitHub Pages.** O Pages serve arquivos estáticos, e o
V1 depende de servidor em quase tudo que o define: banco, sessão, permissões
por perfil, geração de CSV e XLSX.

## Aplicação: Railway

### Primeira vez

1. Crie o projeto no Railway e adicione o serviço **Postgres**.
2. Adicione o serviço da aplicação apontando para este repositório. O
   [`railway.json`](../railway.json) já manda usar o `Dockerfile`.
3. Preencha as variáveis de ambiente (abaixo).
4. Publique. O container aplica as migrations pendentes na subida, pelo
   `docker-entrypoint.sh`, antes de aceitar tráfego.
5. Carregue o catálogo real, uma vez (abaixo).
6. Entre pelo SSO com um e-mail que esteja em `BOOTSTRAP_ADMIN_EMAILS`. É o
   primeiro login que cria o usuário, e é essa variável que o faz nascer Admin.

### Variáveis de ambiente

| Variável                     | Valor                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`               | referência ao Postgres do projeto: `${{Postgres.DATABASE_URL}}`  |
| `AUTH_SECRET`                | `openssl rand -base64 32`                                        |
| `AUTH_URL`                   | URL pública, ex. `https://catalogo-relacionamento.prod.auvp.net` |
| `AUTH_OIDC_ISSUER`           | `https://sso.auvp.com.br/realms/master`, sem barra no fim        |
| `AUTH_OIDC_CLIENT_ID`        | client OIDC                                                      |
| `AUTH_OIDC_CLIENT_SECRET`    | segredo do client                                                |
| `AUTH_ALLOWED_EMAIL_DOMAINS` | domínios que podem entrar, ex. `auvp.com.br`                     |
| `BOOTSTRAP_ADMIN_EMAILS`     | e-mails que entram como Admin no primeiro login                  |
| `NODE_ENV`                   | `production`                                                     |

As variáveis `STORAGE_*` continuam vazias de propósito: a foto enviada pelo
CRUD é gravada no próprio Postgres, na tabela `arquivos`, e servida por
`/api/arquivos/[id]` atrás da sessão. Ver
[ADR 0007](adr/0007-fotos-no-banco.md). Quando existir um bucket, muda
`salvarFoto` em `src/lib/arquivos.ts` e nada mais.

Variável criada sem valor vale como ausente: painel de plataforma e `.env`
copiado do exemplo costumam deixar a chave vazia, e ela cai no valor padrão em
vez de falhar na validação. O build também não exige `DATABASE_URL`, porque não
abre conexão; quem exige o banco é o processo que serve a aplicação.

`env.ts` recusa produção sem `AUTH_SECRET`, sem o client OIDC completo e sem
`AUTH_ALLOWED_EMAIL_DOMAINS`, e recusa `AUTH_DEV_BYPASS` ligado. A lista de
domínios é a segunda tranca: se o client for criado aberto no provedor, conta
de fora da AUVP é recusada antes de virar usuário ([`acesso-sso.ts`](../src/lib/acesso-sso.ts)). A checagem roda no `instrumentation.ts`, ou
seja, na subida do servidor e não na primeira requisição: o log traz
`Failed to prepare server` com a lista do que falta, o healthcheck não passa e
o Railway marca o deploy como falho. Sem isso, um deploy mal configurado
subiria "saudável" e só quebraria na tela de login.

### Registrar no provedor de SSO

A URL de callback é:

```
https://<seu-dominio>/api/auth/callback/auvp
```

E a de volta do "Sair" (post logout redirect URI):

```
https://<seu-dominio>/login
```

O passo a passo no Keycloak está em [entrega para a TI](10-entrega-ti.md#1-keycloak).

### Migrations

Aplicadas na subida do container, com `prisma migrate deploy`, só executa o
que ainda não rodou e nunca gera migration nova. Seguro em toda subida e com
múltiplas réplicas.

O seed **não** roda em produção: ele carrega usuários, clientes e solicitações
fictícias, e sobrescreve produto que já existe.

### Carga do catálogo real

O banco sobe vazio, e a área não deveria digitar 49 presentes à mão no primeiro
dia. Rode uma vez, de um clone do repositório, com o `DATABASE_URL` apontando
para o Postgres de produção (o Railway mostra a string pública no serviço
Postgres):

```bash
npm ci
npm run fotos:preparar            # gera public/produtos/*.webp
DATABASE_URL="postgres://..." npm run db:catalogo
```

A carga cria as categorias e os produtos que faltam, casando pelo nome, e
**nunca toca em produto que já existe**, nem para corrigir: depois que a
ferramenta sobe, quem manda é o CRUD em `/admin/catalogo`. Rodar de novo é
inofensivo, e serve para levar ao ar um presente novo acrescentado à planilha
em `prisma/catalogo-auvp.ts`.

A carga é o único caminho de dados para produção. Ela não cria usuário, cliente
nem solicitação.

### Healthcheck

`/login`, porque é a única rota que responde sem sessão.

## Vitrine: GitHub Pages

### Habilitar

No repositório: **Settings → Pages → Source: GitHub Actions**. Só isso; o
workflow [`pages.yml`](../.github/workflows/pages.yml) faz o resto.

### Como publica

Todo push em `main` que toque `demo/` dispara o workflow, que compila o CSS com
o Tailwind e publica a pasta. Dá para disparar à mão em **Actions → Vitrine →
Run workflow**.

A URL fica em **Settings → Pages**, no formato
`https://<org>.github.io/<repositorio>/`.

### O que a vitrine mostra

Catálogo, etapas da nova solicitação, lista do consultor, painel de gestão,
detalhe com histórico, fila de compras do Financeiro e os CRUDs. O seletor "Ver
como" troca entre Consultor, Admin e Financeiro e reproduz a matriz de
permissões: é a forma mais direta de mostrar que cada perfil enxerga um
conjunto diferente de telas.

Os dados são fictícios e espelham o seed. Nenhum dado real de cliente entra
ali, e os CPFs aparecem mascarados.

## CI

[`ci.yml`](../.github/workflows/ci.yml) roda em todo push e PR:

- formato, lint, tipos e testes;
- build de produção;
- migrations do zero contra um Postgres real, conferência de que o schema bate
  com as migrations, e o seed rodando duas vezes para provar que é idempotente.
