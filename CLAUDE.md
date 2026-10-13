# Orientações para trabalhar neste repositório

Ferramenta interna da área de Relacionamento da AUVP: catálogo de presentes,
solicitação com carta e acompanhamento do envio. O documento de origem é
`catalogo-presentes-spec-v1.md`.

## Antes de escrever código

Leia `docs/05-perguntas-em-aberto.md`. Boa parte das decisões pendentes já tem
uma suposição registrada e o ponto exato onde mudá-la. Não reinvente uma
resposta que já foi assumida em algum lugar.

## Onde as regras moram

Cada regra de negócio tem **um** lugar. Ao mexer numa delas, mexa lá, nunca
duplique numa tela.

| Regra                           | Arquivo                                   |
| ------------------------------- | ----------------------------------------- |
| Quem pode o quê                 | `src/lib/permissions.ts`                  |
| Quem pode entrar pelo SSO       | `src/lib/acesso-sso.ts`                   |
| Transições, motivos e lote      | `src/lib/status.ts`                       |
| Gasto do mês e limite           | `src/lib/saldo.ts`                        |
| Fila de compras do Financeiro   | `src/lib/compras.ts`                      |
| Fila da expedição               | `src/lib/expedicao.ts`                    |
| Período do Dashboard Logístico  | `src/lib/periodo.ts`                      |
| Status da semana e limiares     | `src/lib/logistica/status-operacional.ts` |
| Trilha, "Kit", atraso e somas   | `src/lib/logistica/demandas.ts`           |
| Presente aprovado → trilha      | `src/lib/logistica/ponte.ts`              |
| Kit que exige bebida junto      | `src/lib/acompanhamentos.ts`              |
| Modelos e montagem da carta     | `src/lib/carta.ts`                        |
| Fornecedor padrão por categoria | `src/lib/fornecedores.ts`                 |
| Upload e leitura de foto        | `src/lib/arquivos.ts`                     |
| Leitura do CSV de clientes      | `src/lib/importacao-clientes.ts`          |
| Catálogo de presentes da área   | `prisma/catalogo-auvp.ts`                 |
| Aritmética de dinheiro          | `src/lib/money.ts`                        |
| Colunas e formato da exportação | `src/lib/export/`                         |
| Validação de formulário         | `src/lib/validators/`                     |
| Leitura de catálogo e clientes  | `src/lib/providers/`                      |
| Cores, tipografia e raio        | `src/styles/auvp-tokens.css`              |

## Invariantes

Coisas que o código já garante e que não devem ser afrouxadas:

- **Nada é deletado.** Produto, categoria e usuário são desativados. Uma
  solicitação antiga precisa continuar legível como foi criada.
- **Valores congelam na criação.** `valorUnitario` é cópia, não referência.
  Reajuste de preço não mexe em solicitação já feita.
- **Endereço é snapshot** na solicitação, não no cliente.
- **Dinheiro é `Prisma.Decimal`.** `number` só na fronteira de exibição.
- **Autorização acontece no servidor**, via `auth-guards.ts`. Esconder botão
  não é controle de acesso.
- **Só entra quem é da AUVP**, pelo domínio do e-mail, conferido antes de o
  usuário existir no banco. Não confie no client OIDC estar fechado no
  provedor; produção não sobe sem `AUTH_ALLOWED_EMAIL_DOMAINS`.
- **Consultor só enxerga as próprias solicitações.** Use
  `filtroDeSolicitacoes`, não um `where` escrito à mão. Nulo quer dizer
  **nenhuma**, e não todas: a Logística tem escopo nulo, e um `?? {}` abriria
  todas as solicitações para ela.
- **Preço de item vem do banco na hora de gravar.** `criarSolicitacao` relê o
  produto; valor que chega do navegador não é usado.
- **Tudo conta no saldo do mês**, cancelado e devolvido inclusive, a área
  reenvia. `STATUS_FORA_DO_SALDO` está vazia de propósito.
- **Quem decide a rota é `Produto.origem`**, não a quantidade em estoque. É a
  coluna "Estoque" da planilha da área: `estoque_interno` não passa pelo
  Financeiro, `mediante_pedido` passa. A contagem de peças é refinamento
  opcional, e a área não a mantém hoje.
- **Estoque não passa pelo Financeiro.** Solicitação com tudo em estoque é
  liberada para envio na própria aprovação (`proximoDepoisDaAprovacao`). O
  atalho pula o Financeiro, nunca a aprovação, nada vai do pedido do consultor
  para a expedição sem o OK do Admin.
- **`Produto.valor` nulo não é zero.** Seis produtos vieram sem preço; a tela
  diz "valor a definir". `SolicitacaoItem.valorUnitario` continua obrigatório e
  congela como zero nesses casos.
- **O lote não afrouxa a máquina de estados.** `caminhoDeEncaminhamento` insere
  o passo da aprovação quando ele falta, e cada passo vira uma linha do
  histórico. O que não pode andar volta como ignorado, com o motivo.
- **Kit que embala bebida não vai sozinho.** Três presentes existem para levar
  um vinho, e a planilha da área já diz isso no nome ("Escolha o vinho").
  O pareamento é por rótulo, não por produto: o kit declara
  `exigeAcompanhamento: 'vinho'` e cada garrafa declara
  `serveComoAcompanhamento: 'vinho'`, então acrescentar um vinho novo não mexe
  em nenhum kit. Presente específico nunca satisfaz: é texto livre, e trava que
  se contorna digitando qualquer coisa não é trava. A tela impede e
  `criarSolicitacao` valida de novo.

- **Modo demonstração só na homologação.** `MODO_DEMONSTRACAO` troca o SSO
  por cartões de perfil fictícios (`src/lib/demonstracao.ts`); `env.ts` recusa
  subir fora da Vercel ou no endereço da produção. Não afrouxe essas travas.

- **Rastreio não muda status.** Gravar o código diz que saiu; "entregue" é
  decisão de quem acompanha.
- **Telas leem catálogo e clientes pelos providers**, não pelo Prisma direto.
- **A tela não pisca.** Filtro é mudança da mesma tela: navega por
  `FormDeFiltro`/`LinkDeFiltro` (`src/components/filtro-sem-piscar.tsx`), nunca
  por `<form method="get">` solto nem `<a href>` cru, que recarregam a
  aplicação inteira. A entrada de conteúdo parte de `opacity: 0.65`, não de
  zero, e só roda na troca de rota. Na vitrine, `render()` só recria o elemento
  animado quando a tela muda, senão digitar uma letra reabriria a página.
- **Movimento não pode gerar layout shift.** Anime só `opacity` e `transform`,
  e a entrada de rota só `opacity`: `transform` no wrapper da transição prende
  todo `position: fixed` da página a ele (o login ficava numa faixa de 80 px).
  Todo `loading.tsx` reserva as medidas exatas do conteúdo, e toda imagem tem
  proporção e dimensões declaradas. O CLS medido hoje é ≤ 0,0031, com um
  contexto de navegador novo por rota, porque `addInitScript` é cumulativo e
  medir tudo na mesma página soma o mesmo deslocamento várias vezes.
- **A identidade visual vem do Design System AUVP**, portada de
  `ProdutosAUVP/central`. Use os tokens (`bg-success`, `text-muted-foreground`),
  nunca a paleta crua do Tailwind (`bg-amber-100`), ela não passa pelas travas
  de contraste do DS nem acompanha o tema escuro. Ver
  `docs/08-identidade-visual.md`.

## Convenções

- Código, comentários e mensagens de commit em português.
- Nomes de domínio em português (`solicitacao`, `consultor`), casando com o
  vocabulário da área e com o schema.
- Tabelas e colunas em `snake_case` via `@map`; modelos Prisma em `PascalCase`.
- Comentário explica **por quê**, não o que a linha faz.

## Ao alterar o banco

1. Edite `prisma/schema.prisma`.
2. `npm run db:migrate`: sempre gere a migration.
3. Regra que não pode ser violada por script vai também como CHECK constraint.

A CI recusa schema que não bate com as migrations.

## Antes de abrir PR

```bash
npm run check
```

Formato, lint, tipos e testes. É o que a CI roda.

Regra de negócio nova entra com teste. Os testes existentes cobrem transições
de status, permissões, aritmética monetária, CPF, fuso horário e exportação,
siga o mesmo padrão.

## O que está construído e o que não está

O caminho principal está construído de ponta a ponta: catálogo, nova
solicitação, mudança de status, fila de compras, fila da expedição com
exportação, CRUD de produto e categoria com upload de foto, CRUD de cliente
com importação CSV e edição de usuário.

A nova solicitação é a tela mais detalhada, porque é onde o consultor passa o
tempo dele: validação por campo (o "Continuar" acende o que falta e leva o
cursor até lá, em vez de ficar desligado sem explicar), histórico do que já foi
mandado para aquele cliente, limite do mês contado com o pedido atual dentro,
prévia da carta ao lado do campo e na revisão, e a rota que o pedido segue
depois da aprovação.

O caminho do Admin é por pilha: a gestão encaminha em lote, e a expedição
devolve o rastreio que o consultor lê na própria solicitação.

O que continua fora do V1, por decisão registrada em
`docs/05-perguntas-em-aberto.md`: geração da carta em formato de impressão,
integração com o sistema da expedição (que escreveria rastreio e status sem
digitação) e as integrações da fase 2 (Tiny e Salesforce, que já têm provider e
campos reservados).

## Logística

Módulo do time de Logística, na mesma aplicação ([ADR 0008](docs/adr/0008-logistica-no-mesmo-app.md)):
o Dashboard Logístico em `/logistica`, que todos os perfis leem, e o perfil
`logistica`, que opera a expedição. Ver `docs/11-logistica.md`.

- **Um período só** filtra o painel inteiro e a exportação, e mora na URL. Toda
  conta de semana, mês ou intervalo passa por `src/lib/periodo.ts`: semana
  ISO, calendário de São Paulo, intervalo `[inicio, fim)`.
- **Observação de demanda é filtrada no servidor.** Quem não tem
  `logistica.verObservacoes` não recebe o texto nem no HTML nem na planilha;
  esconder na tela não basta.
- **A trilha é manual.** A Logística cadastra as demandas aqui; ela não
  espelha o ClickUp, que é só um link. O presente aprovado entra sozinho, na
  mesma transação da mudança de status (`src/lib/logistica/ponte.ts`).
- **Integração externa não trava a aprovação.** O Tiny entra por fila no banco,
  gravada na mesma transação da mudança de status ([ADR 0009](docs/adr/0009-integracoes-por-fila.md)).

## Catálogo e fotos

O catálogo é o de verdade: 49 presentes transcritos da planilha da área em
`prisma/catalogo-auvp.ts`, conferidos campo a campo. Depois de a ferramenta
subir, quem manda é o CRUD, este arquivo é o ponto de partida.

Em produção a carga é `npm run db:catalogo` (`prisma/carga-catalogo.ts`), e não
o seed: o seed traz usuários e clientes fictícios junto e sobrescreve produto
que já existe, o que desfaria o preço corrigido pelo CRUD. A carga só cria o
que falta e nunca toca no que está lá.

As fotos originais que a área mandou ficam em `imgs produtos/`.
`npm run fotos:preparar` converte para `public/produtos/<slug>.webp`, na
moldura 3:4 que o catálogo serve. Rode de novo quando ela trocar ou
acrescentar foto. Quando o mesmo presente tem mais de um arquivo, porque a
foto voltou em outro formato, a conversão tenta um por um até abrir, JPG antes
de HEIC: não é preciso apagar o original ruim.

## Vitrine estática

`demo/` é uma demonstração com dados fictícios publicada no GitHub Pages, para
mostrar as telas a quem aprova o V1. **A aplicação real não roda no Pages**,
ela precisa de Postgres, sessão e servidor. A produção é da TI, por Docker
(`docs/10-entrega-ti.md`); a homologação é a Vercel, a cada merge no `main`
(`docs/12-homologacao-vercel.md`). Migration nova roda sozinha nas duas: no
`docker-entrypoint.sh` e no `npm run vercel-build`.

Ao mudar uma tela de forma relevante, vale refletir na vitrine.
