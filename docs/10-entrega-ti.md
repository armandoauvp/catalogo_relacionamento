# Entrega para a TI

Tudo o que a TI precisa para publicar a ferramenta em
**`https://catalogo-relacionamento.prod.auvp.net`**. Não depende de
plataforma: a entrega é uma imagem Docker, um Postgres e um client no Keycloak.

O código está pronto. O que falta está abaixo, na ordem em que deve ser feito.

## Resumo

| O quê       | Valor                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| URL pública | `https://catalogo-relacionamento.prod.auvp.net`                        |
| Imagem      | `Dockerfile` na raiz do repositório, Node 22, porta `3000`             |
| Banco       | PostgreSQL 16, um banco dedicado                                       |
| SSO         | Keycloak `https://sso.auvp.com.br`, realm `master`                     |
| Client OIDC | `catalogo_relacionamento`, **confidencial** (com secret)               |
| Callback    | `https://catalogo-relacionamento.prod.auvp.net/api/auth/callback/auvp` |
| Healthcheck | `GET /login` → `200`                                                   |
| Estado      | nenhum no container: sessão em cookie cifrado, fotos no Postgres       |

## 1. Keycloak

No console de administração, realm **master**, **Clients →
`catalogo_relacionamento`**. O client já existe; o que foi conferido de fora
em setembro de 2026 é que ele ainda está **público** e **sem nenhuma URL de
retorno registrada**. Os dois impedem o login.

### Settings → Capability config

| Campo                 | Valor                         |
| --------------------- | ----------------------------- |
| Client authentication | **On**, é o que cria o secret |
| Authorization         | Off                           |
| Standard flow         | **On**                        |
| Direct access grants  | Off                           |
| Implicit flow         | Off                           |
| Service accounts      | Off                           |

A aplicação autentica o client no servidor e manda PKCE (S256) junto. Client
público seria mais fraco sem ganho nenhum, porque o segredo nunca chega ao
navegador.

### Settings → Access settings

| Campo                           | Valor                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Root URL                        | `https://catalogo-relacionamento.prod.auvp.net`                                                                          |
| Home URL                        | `https://catalogo-relacionamento.prod.auvp.net`                                                                          |
| Valid redirect URIs             | `https://catalogo-relacionamento.prod.auvp.net/api/auth/callback/auvp`<br>`http://localhost:3000/api/auth/callback/auvp` |
| Valid post logout redirect URIs | `https://catalogo-relacionamento.prod.auvp.net/login`<br>`http://localhost:3000/login`                                   |
| Web origins                     | `+` (o mesmo das redirect URIs)                                                                                          |

As linhas com `localhost:3000` servem para quem desenvolve testar o SSO de
verdade na própria máquina. São opcionais: sem elas o desenvolvimento segue
pelo login sem SSO.

A URL de post logout é a volta do botão "Sair". A ferramenta encerra também a
sessão do Keycloak, senão o próximo "Entrar" voltaria logado sem pedir senha,
e sem essa URL registrada o Keycloak recusa o retorno.

### Credentials

**Client Authenticator: Client Id and Secret.** Copie o **Client secret**:
ele vira `AUTH_OIDC_CLIENT_SECRET`. Guarde no cofre de segredos, nunca no
repositório.

### Client scopes

`profile` e `email` precisam estar como **Default**. A ferramenta lê `email`,
`email_verified` e `name`.

### Usuários

Cada pessoa precisa ter **e-mail preenchido e verificado** no Keycloak. A
ferramenta recusa quem chega com `email_verified: false`. Em usuário vindo de
LDAP ou AD, isso depende de a federação estar com **Trust Email** ligado. Se
alguém da AUVP vir "acesso negado" no primeiro login, é quase sempre isso.

Só entra e-mail de domínio listado em `AUTH_ALLOWED_EMAIL_DOMAINS`, conferido
antes de o usuário existir no banco. Não é preciso restringir o client por
grupo no Keycloak para isso.

## 2. Banco

PostgreSQL 16, com um banco e um usuário dedicados. O usuário precisa poder
criar tabelas no schema `public`: as migrations rodam com ele.

```sql
CREATE USER catalogo WITH PASSWORD '<senha forte>';
CREATE DATABASE catalogo_presentes OWNER catalogo;
```

Conexão por `DATABASE_URL`, no formato
`postgresql://catalogo:<senha>@<host>:5432/catalogo_presentes?schema=public`.

**Backup diário com retenção** antes de entrar dado real: a base guarda CPF,
telefone e endereço de clientes, e as fotos de produto enviadas pelo cadastro
(tabela `arquivos`).

## 3. Aplicação

### Imagem

```bash
docker build -t catalogo-relacionamento .
```

O build não precisa de nenhum segredo. O container:

- escuta em `PORT` (padrão `3000`) e roda como usuário sem privilégio (uid 1001);
- aplica as migrations pendentes na subida (`prisma migrate deploy`) antes de
  aceitar tráfego. É seguro a cada deploy e com várias réplicas: só executa o
  que falta e nunca gera migration nova;
- valida as variáveis na subida e **morre com a lista do que falta** se algo
  obrigatório não veio. O log mostra `Failed to prepare server` e o motivo, e
  o healthcheck não passa.

### Variáveis de ambiente

| Variável                     | Valor em produção                                         | Segredo |
| ---------------------------- | --------------------------------------------------------- | ------- |
| `NODE_ENV`                   | `production` (já vem na imagem)                           |         |
| `DATABASE_URL`               | a string do banco acima                                   | sim     |
| `AUTH_SECRET`                | 32 bytes aleatórios: `openssl rand -base64 32`            | sim     |
| `AUTH_URL`                   | `https://catalogo-relacionamento.prod.auvp.net`           |         |
| `AUTH_OIDC_ISSUER`           | `https://sso.auvp.com.br/realms/master`, sem barra no fim |         |
| `AUTH_OIDC_CLIENT_ID`        | `catalogo_relacionamento`                                 |         |
| `AUTH_OIDC_CLIENT_SECRET`    | o secret da aba Credentials                               | sim     |
| `AUTH_OIDC_NAME`             | `AUVP SSO` (texto do botão de login)                      |         |
| `AUTH_ALLOWED_EMAIL_DOMAINS` | `auvp.com.br` (vírgula para mais de um)                   |         |
| `BOOTSTRAP_ADMIN_EMAILS`     | e-mail de quem administra a área, ver abaixo              |         |

Não defina `AUTH_DEV_BYPASS`: ligada em produção, a aplicação se recusa a
subir. As variáveis `STORAGE_*`, `TINY_*` e `SALESFORCE_*` ficam vazias; são
de integrações que ainda não existem.

**`AUTH_SECRET` não pode mudar entre réplicas nem entre deploys.** Ele cifra o
cookie de sessão: trocar desloga todo mundo, e réplicas com valores diferentes
derrubam a sessão a cada requisição que cai na outra.

**Issuer:** o Auth.js compara o `iss` do token caractere a caractere.
`https://sso.auvp.com.br/`, a raiz, falha. O valor certo é o que responde em
`<issuer>/.well-known/openid-configuration`, e já foi conferido.

### Proxy reverso e TLS

O TLS termina no proxy da TI; o container fala HTTP na `3000`. O proxy precisa
repassar **`Host`** e **`X-Forwarded-Proto: https`**. Sem eles, o cookie de
sessão sai sem `Secure` e o retorno do SSO pode apontar para `http://`.

### Saída de rede do container

| Destino               | Para quê                                        |
| --------------------- | ----------------------------------------------- |
| `sso.auvp.com.br:443` | descoberta OIDC, troca do código, chaves (JWKS) |
| `viacep.com.br:443`   | preencher endereço pelo CEP                     |
| o Postgres            | banco                                           |

### Réplicas

Pode rodar mais de uma: não há estado no container. A sessão é um cookie
cifrado com `AUTH_SECRET`, e as fotos ficam no Postgres.

## 4. Primeira subida

1. Publicar a imagem com as variáveis acima. O banco sobe vazio e as
   migrations criam as tabelas.
2. **Carregar o catálogo real, uma vez.** São os 49 presentes da área, com
   foto. A carga só cria o que falta e nunca altera produto existente, então
   rodar de novo é inofensivo. De qualquer máquina que alcance o banco, a
   partir de um clone do repositório:

   ```bash
   docker run --rm -v "$PWD":/app -w /app \
     -e DATABASE_URL="postgresql://..." \
     node:22-alpine sh -c "npm ci && npm run db:catalogo"
   ```

   Ou, com Node 22 instalado: `npm ci` e depois
   `DATABASE_URL="postgresql://..." npm run db:catalogo`.

   **Não rode `npm run db:seed` em produção.** O seed cria usuários, clientes
   e pedidos fictícios.

3. **Primeiro Admin.** Quem estiver em `BOOTSTRAP_ADMIN_EMAILS` entra pelo SSO
   e já nasce Admin. Os demais nascem Colaborador AUVP e são promovidos por esse Admin
   em `/admin/usuarios`, sem passar pela TI. Sem essa variável, ninguém
   conseguiria promover ninguém.

## 5. Conferência depois do deploy

- [ ] `GET https://catalogo-relacionamento.prod.auvp.net/login` responde `200`
      e mostra o botão "Entrar com AUVP SSO".
- [ ] O log da subida mostra `Aplicando migrations...` e nenhum
      `Failed to prepare server`.
- [ ] O login pelo SSO volta para a ferramenta logado. Se o Keycloak disser
      "Invalid parameter: redirect_uri", falta a URL de callback no client.
- [ ] Quem está em `BOOTSTRAP_ADMIN_EMAILS` vê o menu "Administração".
- [ ] O catálogo mostra os 49 presentes com foto.
- [ ] Um e-mail de fora da AUVP é recusado com a mensagem de acesso negado.
- [ ] "Sair", no menu do nome, volta para `/login`, e o "Entrar" seguinte
      pede a senha de novo.
- [ ] O backup do Postgres está agendado.

## Problemas comuns

| Sintoma                                                  | Causa provável                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Container reinicia com `Em produção o SSO é obrigatório` | variável da tabela acima faltando; o log lista quais                     |
| Keycloak: `Invalid parameter: redirect_uri`              | callback não registrada, ou `AUTH_URL` diferente da URL real             |
| Keycloak: `Invalid client credentials`                   | secret errado, ou Client authentication desligado                        |
| Volta ao login com "acesso negado"                       | e-mail fora de `AUTH_ALLOWED_EMAIL_DOMAINS`, ou `email_verified` falso   |
| Login funciona e cai deslogado em seguida                | `AUTH_SECRET` diferente entre réplicas, ou proxy sem `X-Forwarded-Proto` |
| "Sair" mostra tela de confirmação do Keycloak            | post logout redirect URI não registrada                                  |
| Erro `unexpected "iss"`                                  | `AUTH_OIDC_ISSUER` com barra no fim ou apontando para a raiz             |

Mais contexto: [deploy](07-deploy.md), [perguntas em aberto](05-perguntas-em-aberto.md)
e [checklist de lançamento](09-checklist-de-lancamento.md).
