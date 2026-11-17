# Checklist de lançamento

O caminho de hoje até a área usando a ferramenta no dia a dia.

Última atualização: 06/11/2026.

O código está construído e testado. O que falta não é código: é **credencial,
decisão e acompanhamento**. Este documento separa as três coisas e diz quem faz
cada uma.

## Onde estamos

A produção é a **Vercel**, desde 19/10/2026, em
`https://catalogo-logistica.vercel.app` (o endereço antigo,
`catalogo-relacionamento.vercel.app`, redireciona). Publica a cada commit no
`main`, com banco Neon em São Paulo e login pelo **Google da AUVP**. O passo a
passo está em [produção na Vercel](12-producao-vercel.md). A imagem Docker para
a TI ([entrega para a TI](10-entrega-ti.md)) fica pronta como alternativa.

## O que já está pronto

Não precisa de nada de ninguém:

- catálogo, nova solicitação com carta, aprovação em lote, fila de compras,
  fila da expedição com exportação, rastreio e "Entregue", e os CRUDs de
  produto, categoria, cliente, usuário e modelos de carta;
- os 49 presentes da planilha da área, carregados sozinhos no primeiro deploy
  com o banco vazio;
- perfis Colaborador AUVP, Consultor, Financeiro, Logística, Admin geral e os admins por área
  (Relacionamento e Logística), com tour guiado em cada um;
- o módulo de Logística: Dashboard em `/logistica`, trilha manual de demandas,
  recorrentes, custo de envio em percentual e o presente aprovado entrando
  sozinho na trilha ([Logística](11-logistica.md));
- a integração com o Tiny: presente em "Organizando envio" vira pedido, envio
  em lote por planilha, nova venda avulsa, e situação e rastreio voltando
  sozinhos ([Tiny](13-tiny.md));
- o cadastro de cliente vindo do site, por chave (`/api/publico/clientes`);
- migrations aplicadas sozinhas a cada deploy, na Vercel e no Docker;
- a vitrine no GitHub Pages, para mostrar as telas a quem aprova.

## Etapa 1: produção na Vercel ✅

Feito em 20/10/2026: `MODO_DEMONSTRACAO` apagado, login Google funcionando,
domínios `auvp.com.br` e `investidorsardinha.com.br` em
`AUTH_ALLOWED_EMAIL_DOMAINS`.

**A conferir:** se o banco foi zerado dos dados fictícios da demonstração antes
de a área entrar ([passo 4](12-producao-vercel.md#passo-4-tirar-os-dados-fictícios)).
Com dado real já gravado, **não** zere: apague só o que for fictício.

## Etapa 2: ligar o Tiny

Quem faz: quem tem acesso à Vercel, ao GitHub e ao Tiny. Passo a passo em
[Tiny](13-tiny.md#ligar).

- [ ] `TINY_API_TOKEN` em Production (o mesmo token que outra integração já
      use, se houver; gerar outro derruba a anterior);
- [ ] `CRON_SECRET` na Vercel e como secret do GitHub Actions;
- [ ] agendador externo (cron-job.org, a cada 5 minutos), porque o GitHub
      Actions rodou de 3 em 3 horas ou mais, e não de 10 em 10 minutos;
- [ ] **SKU em todo produto do catálogo** (responsável: Murilo), em
      `/admin/catalogo/skus`. Presente com produto sem SKU fica em Falhou;
- [ ] transportadora, serviço e marcador padrão dos presentes, em `/tiny`;
- [ ] primeiro pedido real: conferir no Tiny se natureza da operação e forma de
      envio saíram como a AUVP lança à mão.

## Etapa 3: o time entra

Cada pessoa entra uma vez pelo Google, o que a cria como **Colaborador AUVP**: pode pedir à Logística e ler o painel, e nada além. Quem
está em `BOOTSTRAP_ADMIN_EMAILS` já entra como Admin e ajusta em
`/admin/usuarios`:

- quem é Consultor: quem pede presente precisa ser promovido, e o Admin de
  Relacionamento faz isso. Os consultores que já existiam não mudaram;
- quem é Admin geral, Admin de Relacionamento, Admin de Logística, Financeiro
  ou Logística. Só o Admin geral promove a admin
  ([perfis e permissões](02-perfis-e-permissoes.md));
- o **limite mensal** de cada consultor, se houver. Sem ele, a barra do mês
  some em vez de mostrar zero.

Não existe convite nem cadastro de usuário: o login é a porta.

A carga inicial é da área: clientes por CSV em `/admin/clientes`, preço dos
seis produtos sem valor, e equipe e FAQ da Logística.

## Etapa 4: o Keycloak, quando a TI entregar

Não bloqueia nada: o Google já está no ar e os dois logins convivem, casados
pelo e-mail. Falta a TI ligar o secret no client `catalogo_relacionamento` e
registrar as URLs de retorno com o endereço de produção
([passo 7](12-producao-vercel.md#passo-7-o-keycloak-quando-a-ti-entregar)).

**Pergunte junto:** o token devolve grupo ou departamento? Se devolver, dá para
mapear perfil automaticamente (`AUTH_OIDC_GROUPS_CLAIM`, reservado e ainda não
lido pelo código).

## Etapa 5: decisões da área

Nenhuma bloqueia o uso, todas têm uma suposição registrada em
[perguntas em aberto](05-perguntas-em-aberto.md), e cada uma diz onde mudar.

### Relacionamento

| Pergunta                                                    | Assumido hoje                           | Custo de mudar                  |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| Os seis produtos sem preço têm custo unitário?              | ficam "valor a definir" e somam zero    | preencher no CRUD, zero código  |
| O Financeiro pode ver CPF, telefone e endereço?             | pode, por coerência com a exportação    | uma linha em `permissions.ts`   |
| "Pendente" e "Aguardando aprovação" são momentos distintos? | são                                     | `FLUXO_LINEAR` em `status.ts`   |
| Existe alçada por valor para aprovar?                       | não, qualquer Admin aprova              | regra nova na mudança de status |
| Estourar o limite mensal bloqueia?                          | só sinaliza                             | checagem em `criarSolicitacao`  |
| Como a carta chega ao cliente hoje?                         | digitada aqui, impressa como sempre foi | define se a impressão entra     |
| Há histórico de solicitações a migrar?                      | não                                     | o modelo já aceita carga        |

### Logística e Tiny

| Pergunta                                       | Assumido hoje                                 | Custo de mudar                        |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| Quantos pedidos fazem a semana "crítica"?      | 3 atrasadas, ou 2 sendo um quarto das abertas | `LIMIARES` em `status-operacional.ts` |
| Em que departamento entra o presente?          | Relacionamento, fora da lista do Financeiro   | uma linha em `PONTE` (`ponte.ts`)     |
| Quem vê o custo dos envios?                    | todos menos Consultor e Colaborador           | uma linha em `permissions.ts`         |
| Quem lê as observações das demandas?           | só Logística e Admin                          | uma linha em `permissions.ts`         |
| O lote do Tiny pode ser recorrente?            | não; proposta é tarefa na trilha confirmada   | regra nova                            |
| Como entram os pedidos do e-commerce no fluxo? | não entram, nascem direto no Tiny             | depende da resposta                   |

## Etapa 6: acompanhar as primeiras semanas

O que vale olhar, e o que fazer se aparecer:

- **primeira solicitação de verdade percorrendo o fluxo inteiro**, do pedido do
  consultor até o pedido no Tiny e o rastreio de volta. É o teste que nenhum
  ambiente de desenvolvimento faz;
- **pedido em Falhou em `/tiny`**: quase sempre SKU faltando; preencha e use
  Reenviar;
- **presente que a área pede e não está no catálogo**: cadastra pelo CRUD, não
  precisa de deploy;
- **foto que ficou ruim na moldura 3:4**: troca pelo CRUD, ou manda o arquivo
  novo para `imgs produtos/` e roda `npm run fotos:preparar`;
- **backup do Postgres**: o Neon gratuito guarda pouco histórico. Vale um
  `pg_dump` periódico da conexão direta, guardado fora da Vercel;
- **termos do plano Hobby**: a Vercel o reserva para uso não comercial. Se
  questionar, a saída é o Pro, sem mudança de código.

## O que continua fora

Por decisão registrada, não por falta de tempo:

- **geração da carta em formato de impressão.** A prévia existe e é dela que o
  arranjo de impressão vai partir, quando a área disser como a carta chega hoje;
- **Salesforce.** Provider e campos já reservados, ver
  [integrações da fase 2](04-integracoes-fase-2.md);
- **ClickUp.** A trilha é manual; a tarefa de lá, quando existe, é só um link;
- **bucket de fotos.** Hoje a foto vai no Postgres, o que destravou o CRUD sem
  depender de infraestrutura. Vira assunto se o catálogo passar de algumas
  centenas de fotos.
