# Perguntas em aberto

O que ainda depende de resposta, onde isso aparece no código, e o que foi
assumido para não travar a construção.

Última atualização: setembro de 2026.

## Respondidas

### Permissões do perfil Financeiro ✅

> Recebe as solicitações enviadas para compra contendo data, produto, valor e
> site. Consegue alterar o status do pedido.

Implementado: tela `/financeiro/compras` e permissão de alterar status. Ver
[perfis e permissões](02-perfis-e-permissoes.md).

### Canceladas e devolvidas contam no saldo do mês ✅

> Devolvidos e cancelados podem entrar na conta sim, porque normalmente
> reenviamos.

Implementado: `STATUS_FORA_DO_SALDO` ficou vazia em `src/lib/status.ts`. A
spec v1 pedia o contrário; a regra da área prevalece. Ver
[fluxo de status](03-fluxo-de-status.md#efeito-no-saldo).

### O que já está em estoque não passa pelo Financeiro ✅

> Os itens que já temos em estoque não passam pelo financeiro, então é preciso
> que haja uma forma deles passarem direto pra expedição, hoje todos esses
> dados vão pra expedição via planilha.

Implementado em duas partes: o atalho de status
(`proximoDepoisDaAprovacao`, de "Aguardando aprovação" direto para
"Organizando envio") e a tela `/expedicao`, que substitui a planilha e exporta
em CSV e XLSX. Ver [fluxo de status](03-fluxo-de-status.md).

### As bebidas vêm sempre do mesmo site ✅

> As bebidas que pedimos são sempre de um site específico:
> `casadabebida.com.br/u`.

Implementado em `src/lib/fornecedores.ts`, como fornecedor padrão da categoria
"Bebidas": o Financeiro passa a ver o site também em item de catálogo, não só
em presente específico. O `/u` do endereço parece truncado; ficou o domínio.
**Confirmar com a área** se o caminho completo importa, e quais outras
categorias têm fornecedor fixo.

### O catálogo real entrou ✅

> A planilha "Lista de Produtos", com 49 presentes, e as fotos em
> `imgs produtos/`.

Transcrita em `prisma/catalogo-auvp.ts` e conferida campo a campo contra a
planilha: nome, valor, origem, link, nota de compra e foto. A coluna "Estoque"
virou `Produto.origem`, que é o que decide se a solicitação passa pelo
Financeiro.

Duas coisas ficaram pendentes da área, abaixo.

## Para a área de Relacionamento

### Seis produtos estão sem preço

Vieram sem valor na planilha, todos brindes personalizados ou o kit de caixa
MDF:

- Agenda e Caneta AUVP
- Caneca AUVP
- Caneta e Moleskine AUVP
- Garrafa AUVP
- Kit Canga AUVP
- Caixa MDF para vinho com Acessórios

**Assumido:** `valor` fica nulo, o catálogo mostra "valor a definir" e o item
congela como zero quando alguém o pede, ou seja, **não entra no gasto do mês
de quem pediu**. Faz sentido para brinde comprado em lote, cujo custo já foi
pago antes; deixa de fazer se a área quiser ratear.

**Onde mudar:** basta preencher o valor no cadastro de produto. Nenhuma linha
de código muda.

### O Financeiro pode ver CPF, telefone e endereço do cliente?

A lista pedida para a fila de compras, data, produto, valor, site, não inclui
esses campos. Mas a spec dá ao Financeiro a permissão de exportar, e a
exportação carrega CPF, telefone e endereço.

**Assumido:** pode ver, por coerência com a exportação.
**Onde mudar:** `PENDENTE_CONFIRMACAO.financeiroVeDadosSensiveis` em
`src/lib/permissions.ts`. Uma linha, e vale nos dois lugares.

### "Pendente" e "Aguardando aprovação" são momentos distintos?

Os dois existem no fluxo. Se forem a mesma coisa na prática, o fluxo perde uma
etapa e a solicitação já nasce em "Aguardando aprovação".

**Assumido:** são distintos. "Pendente" é rascunho recém-criado; "Aguardando
aprovação" é o que entrou na fila de quem aprova.
**Onde mudar:** `FLUXO_LINEAR` em `src/lib/status.ts`.

### Quem aprova, e existe alçada por valor?

Hoje qualquer Admin aprova, sem alçada.
**Se houver alçada:** entra como regra na mudança para "Aguardando compra",
comparando `valor_total` com o teto do aprovador.

### Existe limite mensal por consultor? Quem define?

O campo `limite_mensal` existe e é opcional. Quando preenchido, a tela mostra o
consumo contra o limite.

**Assumido:** estourar o limite apenas sinaliza, não bloqueia, é o que a spec
determina para o V1.
**Se for bloquear:** a checagem entra na criação da solicitação, usando
`saldoDoMes`.

### A plaquinha do primeiro milhão é produto de catálogo?

**Assumido:** sim. Está no seed como produto da categoria "Placas e troféus",
com `tipo_valor = medio` porque é personalizada, e "primeiro milhão" existe
como motivo de envio.

### Como a carta chega ao cliente hoje?

Impressa internamente, enviada pelo fornecedor, escrita à mão? A resposta define
se a geração da carta em formato de impressão é urgente ou não.

**Assumido:** a carta é digitada na ferramenta e o processo de impressão segue
como é hoje. A geração em formato de impressão está fora do V1.

O que existe é a **prévia**: a folha montada com saudação, corpo e assinatura,
ao lado do campo enquanto se escreve e de novo na revisão
(`src/components/folha-da-carta.tsx`). Ela não imprime, mas é onde se percebe
que o nome saiu errado. Quando a resposta chegar, o arranjo da impressão parte
dessa mesma folha.

### Há histórico de solicitações a migrar?

Se houver, é preciso saber o formato e o volume. O modelo aceita carga
histórica: `origem` distingue o cliente importado, e o código sequencial pode
partir de um número inicial ajustando `contador_codigo`.

### O consultor precisa acompanhar o envio ✅

> É importante ter um local pra ser preenchido o código de rastreio pro
> consultor conseguir acompanhar se o presente que ele pediu já foi ou não
> entregue, ou via integração já puxar essa info.

Implementado pelo caminho manual: a expedição preenche rastreio e
transportadora em `/expedicao`, e o consultor lê na lista e no detalhe da
própria solicitação (`/solicitacoes/[id]`, criada para isso). Ver
[fluxo de status](03-fluxo-de-status.md#rastreio).

A integração continua em aberto junto com a pergunta abaixo, e ela escreve
nos mesmos dois campos, então ligar uma não mexe em nenhuma tela.

### O pedido de expedição deve nascer dentro do sistema deles?

> O pedido que o consultor fizesse no catálogo já geraria o pedido pra
> expedição dentro do sistema que eles usam, com todas as informações pro
> envio, com exceção da carta.

**Assumido para o V1:** a ferramenta produz a lista pronta em `/expedicao`,
com exportação em CSV e XLSX nas mesmas colunas da planilha atual, o dado
deixa de ser redigitado, mas ainda é levado à mão para o outro sistema.

**Decidido em 08/10/2026:** a solicitação aprovada vira pedido no Tiny, e
também tarefa no ClickUp. Ver [Logística](#logística) e
[ADR 0009](adr/0009-integracoes-por-fila.md). O texto abaixo é o registro de
antes da decisão.

**Para fechar o ciclo**, inclusive puxar o rastreio sozinho, em vez de alguém
digitá-lo: é preciso saber qual é o sistema da expedição e se ele tem API. Se for o Tiny, o caminho já está previsto na fase 2: os campos
`tiny_pedido_id`, `rastreio` e `transportadora` existem no modelo esperando
isso. Ver [integrações da fase 2](04-integracoes-fase-2.md).
**Onde mudar:** `src/lib/expedicao.ts` ganha um provider de escrita, no mesmo
desenho de `src/lib/providers/`.

### O status ser único por solicitação atende?

Uma solicitação com três itens tem um status só. Se um item der problema, o
Admin usa observações e histórico.

**Se não atender:** o status desce para o item e o da solicitação passa a ser
derivado. É mudança de porte médio, melhor decidida antes de a ferramenta
entrar em uso.

## Logística

O módulo novo, ver [Logística](11-logistica.md). A decisão de fundo foi
tomada em 08/10/2026:

> Solicitação aprovada vira tarefa no ClickUp **e** pedido no Tiny. O
> Dashboard Logístico existe só como protótipo e é construído aqui. O
> AUVP-Eventos é referência para a integração com o Tiny, não base de código.

E em 09/10/2026, nos áudios da Logística:

> A trilha é manual, não espelha o ClickUp. Horas saem. Recorrentes são 50 a
> 60% do trabalho. Equipe e FAQ a própria Logística preenche.

Com isso, a solicitação aprovada passa a entrar **na trilha**, e não no
ClickUp. Ver [Logística](11-logistica.md#a-ponte-com-os-presentes).

### Quem vê o Dashboard Logístico?

**Assumido:** todos os perfis, porque a proposta pede leitura "desde operação
até diretoria". As **observações** de cada demanda ficam só com Logística e
Admin: vêm do ClickUp em texto livre e é onde aparecem nome e endereço de quem
recebe.
**Onde mudar:** `PENDENTE_CONFIRMACAO.todosVeemObservacoesDaLogistica` em
`src/lib/permissions.ts`.

### A Logística opera a expedição dentro da ferramenta?

**Assumido:** sim. O perfil Logística vê a fila de `/expedicao` e registra o
rastreio, que até aqui eram de Admin e Financeiro por falta de quem operasse
dentro da ferramenta.
**Onde mudar:** a coluna `logistica` da matriz em `src/lib/permissions.ts`.

### Quando o presente entra na trilha, e quando nasce o pedido no Tiny? ✅

**Decidido em 09/10/2026:** o presente entra **na trilha** na aprovação, na
mesma transação da mudança de status, e cada status seguinte move a fase. Não
há tarefa no ClickUp nem fila para isso. O pedido no Tiny continua planejado
para "Organizando envio", por fila ([ADR 0009](adr/0009-integracoes-por-fila.md)).

**Assumido:** o presente aparece como subsidiária "AUVP Consultoria",
departamento "Relacionamento", com previsão de 7 dias, ou 15 quando ainda há
compra. **Onde mudar:** `PONTE` em `src/lib/logistica/ponte.ts`.

### Previsão de início é redundante? ✅

**Decidido:** fica, opcional, e só aparece na trilha enquanto a demanda não
começou. Ver [Logística](11-logistica.md#como-o-painel-conta).

### Tarefas recorrentes ✅

**Decidido em 09/10/2026:** marcação de recorrente com periodicidade, e a
próxima ocorrência nasce sozinha ao concluir. Os números separam recorrentes
de pontuais. Nada é criado no ClickUp.

### Quais números tornam a semana "alto volume" ou "crítica"?

**Assumido:** alto volume a partir de 10 pedidos e 1,5× a média das 8
semanas anteriores; risco com uma atrasada; crítica com 3 atrasadas, ou 2
que sejam um quarto das abertas. A tabela completa está em
[Logística](11-logistica.md#como-o-painel-conta).
**Onde mudar:** `LIMIARES` em `src/lib/logistica/status-operacional.ts`.

### Subsidiárias e departamentos

O relatório pede a hierarquia "Do Not Scare Soluções Interativas LTDA →
Produto & CX". **Assumido:** os dois vêm de campos do ClickUp, como texto; o
seed traz uma lista ilustrativa. Falta a lista real, que só importa para
conferir o mapeamento quando o ClickUp for ligado.

### ClickUp ✅

**Decidido em 09/10/2026:** a trilha não espelha o ClickUp. A tarefa lá,
quando existe, é um link na demanda. Não é preciso token nem mapear campos.

### O que falta saber do Tiny

- o token da conta da AUVP;
- se os produtos do catálogo têm SKU no Tiny (o campo `sku_tiny` existe e está
  vazio);
- se o presente comprado fora, "mediante pedido", entra no pedido do Tiny ou
  só os itens de estoque;
- a transportadora e a forma de envio padrão, e se há um marcador para
  separar os pedidos de presente dos demais.

## Técnicas, para começar

### Qual é o provedor de SSO da AUVP, e quem libera as credenciais? ✅

> É um Keycloak com OIDC. clientId: catalogo_relacionamento,
> issuer: https://sso.auvp.com.br/, realm: master.

O issuer que o OIDC confere é o do realm, não a raiz do servidor:
`AUTH_OIDC_ISSUER=https://sso.auvp.com.br/realms/master`, sem barra no fim.
O Auth.js compara o `iss` do token com esse valor caractere a caractere, e
`https://sso.auvp.com.br/` falharia na descoberta. Keycloak anterior à versão 17
usa `/auth/realms/master`; o endereço certo é o que responde em
`<issuer>/.well-known/openid-configuration`.

`AUTH_OIDC_CLIENT_ID=catalogo_relacionamento`. **Falta o client secret**, que
só existe se o client estiver com "Client authentication" ligado, e precisa
estar: o código autentica o client no servidor.

O Keycloak manda `email_verified`, e `acesso-sso.ts` recusa quando vem falso.
Usuário federado de LDAP ou AD costuma vir com falso, a menos que a federação
tenha "Trust Email" ligado. **Conferir no primeiro login**: se a mensagem de
acesso negado aparecer para alguém da AUVP, é isso.

**Assumido:** só entra e-mail dos domínios em `AUTH_ALLOWED_EMAIL_DOMAINS`,
obrigatória em produção. **Confirmar** quais domínios a AUVP usa (só
`auvp.com.br`, ou também outro).

Sem as credenciais, a tela de login diz o que falta, e o
desenvolvimento roda com `AUTH_DEV_BYPASS`.

**Conferido de fora em 28/09/2026**, sem credencial: o issuer responde a
descoberta, e o client `catalogo_relacionamento` existe, mas ainda está
**público** (aceita troca de código sem secret) e **sem nenhuma URL de retorno
registrada**. A TI publica em `https://catalogo-relacionamento.prod.auvp.net`;
a configuração exata do client, callback e post logout inclusos, está em
[entrega para a TI](10-entrega-ti.md#1-keycloak).

"Sair" encerra também a sessão do Keycloak (`src/lib/sessao-sso.ts`), senão o
próximo "Entrar" voltaria logado sem pedir senha. Por isso o client precisa
também da URL de post logout.

### O SSO devolve grupo ou departamento?

Se devolver, dá para mapear perfil automaticamente em vez de o Admin promover
na mão. `AUTH_OIDC_GROUPS_CLAIM` está reservado para isso.

No Keycloak, devolve se a TI criar um mapper "Group Membership" no client.
O mapeamento de grupo para perfil ainda não está escrito: a variável está
reservada, o código não a lê.

**Assumido:** não devolve. O primeiro login cria o usuário como `consultor` e o
Admin promove. `BOOTSTRAP_ADMIN_EMAILS` resolve o problema do primeiro Admin.

### Onde ficam as fotos de produto?

**Assumido:** no próprio Postgres, tabela `arquivos`, servidas por
`/api/arquivos/[id]` atrás da sessão. Ver
[ADR 0007](adr/0007-fotos-no-banco.md).

Foi o que destravou o CRUD de produto sem depender de bucket provisionado. As
variáveis `STORAGE_*` continuam reservadas: quando o bucket existir, muda
`salvarFoto` em `src/lib/arquivos.ts` e nada mais, `fotoUrl` já é uma URL.

**Ainda em aberto:** qual bucket (Railway, Cloudflare R2, S3) e quem cria as
credenciais. Vira urgente se o catálogo passar de algumas dezenas de fotos.

## Técnicas, para a fase 2

Ver [integrações da fase 2](04-integracoes-fase-2.md):

- quais campos do Salesforce podem ser consultados e por qual chave;
- quem detém as credenciais de API do Tiny;
- como tratar itens externos, que não geram pedido no Tiny.
