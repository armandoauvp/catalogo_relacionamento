# Produção na Vercel

A ferramenta roda na Vercel, projeto `catalogo-relacionamento`, com o banco
Postgres da Neon conectado pela própria Vercel. É lá que a área usa de
verdade. A [entrega para a TI](10-entrega-ti.md), por Docker, continua no
repositório como alternativa, caso a produção um dia vá para a
infraestrutura da AUVP.

|                | Como está                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Endereço       | `https://catalogo-relacionamento.vercel.app`                                                   |
| Publica quando | a cada commit no `main`                                                                        |
| Funções        | São Paulo (`gru1`), perto do banco                                                             |
| Banco          | Neon, São Paulo, conectado ao ambiente Production                                              |
| Login          | Google da AUVP agora; Keycloak quando a TI entregar o client                                   |
| Quem entra     | só e-mail `@auvp.com.br` ou `@investidorsardinha.com.br`, conferido antes de o usuário existir |
| Plano          | Hobby, por decisão da área (ver [Limites do Hobby](#limites-do-hobby))                         |

O repositório já traz o que a Vercel precisa: `vercel.json` (build por
`npm run vercel-build`, funções em `gru1`) e `scripts/migrar-na-vercel.mjs`,
que a cada deploy de produção aplica as migrations e, se o banco ainda não tem
nenhum produto, carrega o catálogo real.

## Passo 1: o banco

Já está feito: Neon `catalogo-homologacao`, região São Paulo, conectado só ao
ambiente **Production**, sem prefixo nas variáveis. A integração mantém
`DATABASE_URL` (com pooler, a da aplicação) e `DATABASE_URL_UNPOOLED` (direta,
a das migrations).

Para refazer do zero: **Storage → Create Database → Neon**, região **AWS São
Paulo**, **Connect Project** só em Production e **prefixo em branco**. Com
prefixo as variáveis viram `ALGO_DATABASE_URL` e a aplicação não as encontra.

## Passo 2: o login com o Google

Quem faz é alguém com acesso ao Google Cloud da AUVP; não depende da TI do
Keycloak.

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie ou
   escolha um projeto da organização **`investidorsardinha.com.br`**, que é a
   organização do Google Workspace da AUVP.
2. **APIs e serviços → Tela de permissão OAuth**: tipo de usuário **Interno**.
   Interno quer dizer que só contas desse Workspace conseguem entrar; a
   ferramenta confere o domínio do e-mail de novo, de qualquer forma.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - tipo: **Aplicativo da Web**;
   - origens JavaScript autorizadas: `https://catalogo-relacionamento.vercel.app`;
   - URIs de redirecionamento autorizados:
     `https://catalogo-relacionamento.vercel.app/api/auth/callback/google`.
4. Guarde o **ID do cliente** e a **chave secreta do cliente** para o passo 3.

Se a AUVP apontar um domínio próprio para a Vercel, acrescente as duas URLs com
ele também, e troque o `AUTH_URL` do passo 3.

## Passo 3: as variáveis

Em **Settings → Environment Variables**, ambiente **Production**:

| Variável                     | Valor                                              |
| ---------------------------- | -------------------------------------------------- |
| `AUTH_GOOGLE_ID`             | o ID do cliente do passo 2                         |
| `AUTH_GOOGLE_SECRET`         | a chave secreta do passo 2                         |
| `AUTH_URL`                   | `https://catalogo-relacionamento.vercel.app`       |
| `AUTH_ALLOWED_EMAIL_DOMAINS` | `auvp.com.br,investidorsardinha.com.br`            |
| `BOOTSTRAP_ADMIN_EMAILS`     | e-mail de quem administra, separados por vírgula   |
| `AUTH_SECRET`                | um novo para a produção: `openssl rand -base64 32` |

Os dois domínios porque o Workspace é `investidorsardinha.com.br` e as contas
são `@auvp.com.br`: o Google devolve o e-mail principal de cada conta, e
alguém cadastrado com o domínio da organização seria recusado se só o da AUVP
estivesse na lista. Com mais de um domínio, a tela do Google mostra todas as
contas do navegador, e quem barra a conta de fora continua sendo a ferramenta.

E **apague `MODO_DEMONSTRACAO`**. A aplicação se recusa a subir com a
demonstração ligada junto de um login de verdade, para nunca abrir as duas
portas ao mesmo tempo.

As variáveis do Keycloak (`AUTH_OIDC_*`) ficam vazias até o passo 7. Vazia é
tratada como ausente; preenchida pela metade, a aplicação para e diz qual falta.

## Passo 4: tirar os dados fictícios

Enquanto estava em demonstração, o banco recebeu usuários, clientes e
solicitações inventados. Antes de a área entrar, ele precisa ser zerado,
**uma vez só**, com a conexão direta que a Vercel mostra em
**Storage → (o banco) → .env.local**:

```bash
DATABASE_URL="<DATABASE_URL_UNPOOLED da produção>" npx prisma migrate reset --force --skip-seed
```

Apaga tudo e reaplica as migrations. **Depois que a área começar a usar,
nunca mais rode isto**: a partir daí o banco é o registro real dos envios.

## Passo 5: publicar

**Deployments → Redeploy** do último deploy do `main`, ou qualquer commit no
`main`. No log do build aparecem, nesta ordem:

1. `Generated Prisma Client`;
2. `All migrations have been successfully applied`;
3. `Produtos: 49 criados` na primeira vez, e `Catálogo já carregado` nas
   seguintes;
4. o build do Next.

O seed, com dados fictícios, só roda com `MODO_DEMONSTRACAO`. Em produção o
catálogo é o único dado que entra sozinho, e só no banco vazio: depois disso
quem manda é o cadastro em `/admin/catalogo`.

## Passo 6: conferir

- [ ] `/login` mostra "Entrar com o Google da AUVP", sem os cartões da
      demonstração.
- [ ] O login volta para a ferramenta. `redirect_uri_mismatch` no Google quer
      dizer que a URL do passo 2 não bate com o `AUTH_URL`.
- [ ] Uma conta Google pessoal é recusada com "Esta conta não tem acesso".
- [ ] Quem está em `BOOTSTRAP_ADMIN_EMAILS` vê "Administração" no menu.
- [ ] O catálogo mostra os 49 presentes com foto.
- [ ] Cadastrar um produto com foto de celular funciona: a foto é reduzida no
      navegador antes de subir.
- [ ] Os demais entram, nascem consultores, e o Admin ajusta perfil e limite
      em `/admin/usuarios`.

Depois, a carga inicial é da área: clientes por CSV em `/admin/clientes`,
preço dos seis produtos sem valor, e equipe e FAQ da Logística.

## Passo 7: o Keycloak, quando a TI entregar

Peça à TI um client `catalogo_relacionamento` no realm `master`
([configuração](10-entrega-ti.md#1-keycloak)), com:

| Campo                           | Valor                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| Valid redirect URIs             | `https://catalogo-relacionamento.vercel.app/api/auth/callback/auvp` |
| Valid post logout redirect URIs | `https://catalogo-relacionamento.vercel.app/login`                  |

Preencha `AUTH_OIDC_ISSUER` (`https://sso.auvp.com.br/realms/master`),
`AUTH_OIDC_CLIENT_ID` e `AUTH_OIDC_CLIENT_SECRET`, e publique. Os dois botões
aparecem na tela de login, e o usuário é o mesmo nos dois, casado pelo e-mail:
perfil e histórico não mudam. Para ficar só com o Keycloak, apague as
variáveis do Google.

## Limites do Hobby

A área escolheu o plano gratuito. O que muda na prática:

- **Termos de uso.** A Vercel reserva o Hobby para uso não comercial. Uma
  ferramenta interna da empresa fica numa zona cinzenta; se a Vercel
  questionar, a saída é o Pro, sem mudança de código.
- **Agendamento uma vez por dia.** Só afeta a integração com o Tiny, que ainda
  não existe ([ADR 0009](adr/0009-integracoes-por-fila.md)). Para operar, ela
  vai precisar do Pro ou de um agendador de fora.
- **Proteção por senha** só nos previews; a produção fica protegida pelo login.
- **Backup.** O Neon gratuito guarda pouco histórico para restaurar. Vale um
  `pg_dump` periódico da conexão direta, guardado fora da Vercel.

## A demonstração

O modo demonstração (`MODO_DEMONSTRACAO=true`) continua no código: login por
cartões de perfil e os dados fictícios de `prisma/exemplo-presentes.ts` e
`prisma/exemplo-logistica.ts`, recarregados a cada deploy. Ele só sobe na
Vercel, nunca no endereço da TI e nunca junto de um login de verdade. Para
mostrar a ferramenta a alguém sem dar acesso aos dados reais, ele precisa de
outro projeto na Vercel com outro banco; a [vitrine estática](../demo/) é o
caminho mais curto.

## Previews

Cada push fora do `main` gera um preview, que serve só para conferir que **o
build passa**. Não dá para entrar nele: o endereço muda a cada push e não está
nas URLs autorizadas do Google nem do Keycloak, e os previews não têm banco,
para uma migration em revisão não alterar os dados reais.

## Problemas comuns

| Sintoma                                            | Causa provável                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Build para em "O banco não está configurado"       | passo 1 incompleto; a mensagem lista as variáveis de banco que existem |
| Build falha em `migrate deploy`                    | banco fora do ar ou com a conexão direta errada                        |
| Toda página dá erro 500                            | variável do passo 3 faltando; o log das funções lista quais            |
| "MODO_DEMONSTRACAO está ligado junto com um login" | passo 3: apague `MODO_DEMONSTRACAO`                                    |
| Google: `redirect_uri_mismatch`                    | URL do passo 2 diferente do `AUTH_URL`                                 |
| Google: "acesso bloqueado", conta pessoal          | esperado: a tela de permissão é Interna                                |
| Keycloak: `Invalid parameter: redirect_uri`        | redirect URI do passo 7 diferente do `AUTH_URL`                        |
| Erro `prepared statement "s0" already exists`      | acrescente `pgbouncer=true` ao `DATABASE_URL`                          |
| Lento na primeira tela depois de um tempo parado   | o Neon hiberna sem uso; a primeira consulta o acorda                   |
