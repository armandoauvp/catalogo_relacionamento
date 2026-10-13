# Ambiente local

A aplicação inteira roda na sua máquina, com login sem SSO, o catálogo real e
dados fictícios de clientes e solicitações. Não depende de GitHub Pages,
Railway nem SSO.

## O que instalar

- **Node 22** (nodejs.org, versão LTS).
- **Git.**
- **Postgres**, de um destes jeitos:
  - **Docker Desktop**, o mais simples: o `docker compose` abaixo sobe o banco;
  - ou um **Postgres 16** instalado direto (Postgres.app no Mac, instalador
    oficial no Windows), ver [Postgres sem Docker](#postgres-sem-docker).

## Subir do zero

```bash
git clone https://github.com/armandoauvp/catalogo_relacionamento
cd catalogo_relacionamento
cp .env.example .env
```

Abra o `.env` e preencha três linhas:

```
AUTH_SECRET="<cole aqui o texto gerado abaixo>"
AUTH_DEV_BYPASS="true"
BOOTSTRAP_ADMIN_EMAILS="seu.email@auvp.com.br"
```

Para gerar o `AUTH_SECRET`, em qualquer sistema:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Sem ele o login quebra com `MissingSecret`.

Depois:

```bash
docker compose up -d          # Postgres em localhost:5432 (pule se não usar Docker)
npm install
npm run db:migrate            # cria as tabelas
npm run db:seed               # catálogo real, usuários e uns cinco meses de uso fictício
npm run dev
```

Abra <http://localhost:3000>. A primeira abertura de cada tela demora alguns
segundos, porque o modo de desenvolvimento compila sob demanda.

## Entrar sem SSO

Com `AUTH_DEV_BYPASS="true"` a tela de login mostra "Entrar sem SSO", que
aceita um e-mail direto. O e-mail listado em `BOOTSTRAP_ADMIN_EMAILS` entra
como Admin; sem isso, o primeiro usuário do ambiente entraria como consultor e
não haveria ninguém com poder de promover.

O bypass é recusado fora de `NODE_ENV=development`: `env.ts` derruba o boot se
alguém tentar ligá-lo em produção.

"Sair" fica no menu do seu nome, no canto direito da barra.

## Testar o SSO de verdade

O `.env.example` já traz o issuer e o client ID do Keycloak da AUVP. Falta o
secret, que a TI entrega (ver [entrega para a TI](10-entrega-ti.md)), e que
`http://localhost:3000/api/auth/callback/auvp` esteja nas redirect URIs do
client. Com os dois:

```
AUTH_OIDC_CLIENT_SECRET="<secret entregue pela TI>"
```

Reinicie o `npm run dev`. A tela de login passa a mostrar "Entrar com AUVP
SSO" acima do "Entrar sem SSO". O e-mail que vem do Keycloak precisa estar em
`BOOTSTRAP_ADMIN_EMAILS` para você entrar como Admin.

## Ver a ferramenta com os olhos de cada perfil

O bypass aceita qualquer e-mail, e o seed já criou estes usuários. Saia e
entre com um deles para ver o que cada perfil enxerga:

| E-mail                   | Perfil     | Limite mensal |
| ------------------------ | ---------- | ------------- |
| `bia@auvp.com.br`        | Admin      | -             |
| `financeiro@auvp.com.br` | Financeiro | -             |
| `logistica@auvp.com.br`  | Logística  | -             |
| `carlos@auvp.com.br`     | Consultor  | R$ 5.000      |
| `fernanda@auvp.com.br`   | Consultor  | R$ 3.000      |

Com o Carlos, a lista mostra só as solicitações dele; com o Financeiro, a
fila de compras; com a Logística, o Dashboard Logístico e a expedição; com a
Bia, tudo.

O seed é idempotente: pode rodar quantas vezes precisar. `npm run db:reset`
apaga tudo e começa de novo.

## Parar e voltar depois

`Ctrl+C` para o servidor. Para voltar: `docker compose up -d` (se usar Docker)
e `npm run dev`. Os dados continuam lá.

## Trabalhando no banco

```bash
npm run db:studio          # interface visual
npm run db:migrate         # cria migration a partir do schema alterado
npm run db:reset           # apaga tudo, reaplica migrations e roda o seed
```

Depois de alterar `prisma/schema.prisma`, **sempre** gere a migration. A CI
recusa schema que não bate com as migrations.

## Antes de abrir PR

```bash
npm run check    # formato, lint, tipos e testes
```

É exatamente o que a CI roda.

## Vitrine estática

```bash
npm run demo:build        # compila demo/estilo.css
cd demo && python3 -m http.server 8000
```

<http://localhost:8000>

## Postgres sem Docker

Com um Postgres instalado, crie o usuário e o banco que o `.env.example` já
espera, e nada mais muda:

```sql
CREATE USER catalogo WITH PASSWORD 'catalogo' CREATEDB;
CREATE DATABASE catalogo_presentes OWNER catalogo;
```

Ou aponte `DATABASE_URL` para um banco que já exista. Só é preciso que o
usuário possa criar tabelas.

### Windows sem Docker e sem instalador

O instalador oficial do Postgres para Windows (EnterpriseDB, o mesmo que
winget, Chocolatey e Scoop baixam) responde 403 em algumas redes. O pacote npm
`@embedded-postgres/windows-x64` traz os mesmos binários, sem instalador e sem
administrador. Numa pasta fora do repositório, no PowerShell:

```powershell
mkdir $HOME\pgsql-local; cd $HOME\pgsql-local
npm init -y
npm install @embedded-postgres/windows-x64@16.14.0-beta.17
$bin = ".\node_modules\@embedded-postgres\windows-x64\native\bin"
Set-Content pw.tmp "catalogo" -NoNewline
& "$bin\initdb.exe" -D data -U catalogo --pwfile=pw.tmp -A scram-sha-256 -E UTF8 --locale=C
Remove-Item pw.tmp
& "$bin\pg_ctl.exe" -D data -l postgres.log start
```

O usuário e a senha são os que o `.env.example` já espera, e o
`npm run db:migrate` cria o banco `catalogo_presentes` sozinho. Para parar,
`pg_ctl.exe -D data stop`; para voltar, o mesmo `start`. O Postgres não sobe
sozinho com o Windows.
