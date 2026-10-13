# Modelo de dados

Fonte: [`prisma/schema.prisma`](../prisma/schema.prisma). Este documento
explica as decisões que o schema não consegue dizer sozinho.

## Nada é deletado

Produto, categoria e usuário são desativados pelo campo `ativo`, nunca
removidos. Uma solicitação de seis meses atrás precisa continuar legível
exatamente como foi criada, inclusive com o produto que saiu do catálogo.

As chaves estrangeiras usam `onDelete: Restrict` justamente para que uma
exclusão acidental falhe em vez de apagar histórico.

## Valores congelam na criação

`solicitacao_itens.valor_unitario` recebe uma cópia do preço no momento em que
o item é adicionado. Reajustar o preço de um produto não altera solicitação
já feita, e o relatório do mês passado continua fechando.

`solicitacoes.valor_total` é a soma dos itens, gravada na própria linha. É
redundante de propósito: o painel e o saldo mensal leem esse campo sem precisar
de join com os itens.

## Endereço é snapshot

Os campos `entrega_*` moram na solicitação, e não no cliente. Se o cliente se
mudar, a solicitação antiga continua mostrando para onde o presente foi de
fato enviado.

## CPF é a chave de deduplicação

Gravado só com dígitos, sem máscara, com `UNIQUE` e uma CHECK constraint que
recusa qualquer outro formato. Sem isso, `529.982.247-25` e `52998224725`
virariam dois clientes.

## Item: catálogo ou específico, nunca os dois

Um item tem `produto_id` preenchido, **ou** `descricao_livre` + `url_externa`.
A regra existe em dois lugares:

- `itemSchema`, em `src/lib/validators/solicitacao.ts`, para que o consultor
  receba uma mensagem legível;
- CHECK constraint `item_catalogo_ou_especifico`, para que nenhum script,
  seed ou correção manual consiga gravar um item inválido.

## Origem do produto, e não quantidade em estoque

`Produto.origem` responde de onde o presente sai: `estoque_interno` está na
prateleira, `mediante_pedido` é comprado quando alguém pede. É a coluna
"Estoque" da planilha do catálogo, e é ela que decide se a solicitação passa
pelo Financeiro: ver `precisaDeCompra` em `src/lib/status.ts`.

`controla_estoque` é o refinamento opcional: a área não conta peça a peça hoje,
mas se um dia contar, um pedido maior que o saldo vai ao Financeiro mesmo sendo
item de prateleira. Com `false`, a tela omite a disponibilidade em vez de
exibir zero: zero significaria "acabou", que é outra coisa.

## Onde comprar mora no produto

`url_compra` é o link da coluna "Link" da planilha; `nota_de_compra` guarda a
instrução que não é link ("Pedido direto ao fornecedor"). Os dois convivem:
há kit em que parte vem de cada lugar.

Na fila do Financeiro a ordem é: link do presente específico → `url_compra` do
produto → fornecedor padrão da categoria (`src/lib/fornecedores.ts`) → nota.

## Kit que embala bebida não vai sozinho

Três presentes do catálogo existem para levar um vinho, e a planilha da área já
diz isso no nome: "Kit Queijos com Vinho - Escolha o vinho". Chegando sozinhos
ao cliente, chegam pela metade.

O pareamento é por rótulo, e não por produto: `exige_acompanhamento` no kit
guarda `vinho`, e `serve_como_acompanhamento` guarda `vinho` em cada garrafa.
A área acrescenta um vinho ao catálogo sem voltar em nenhum kit, e um kit que
peça `whisky` amanhã não precisa de código novo.

Item de presente específico nunca satisfaz a exigência: é texto livre, e não dá
para afirmar que "uma garrafa de tinto" é o vinho que o kit pede.

A regra mora em `src/lib/acompanhamentos.ts` e aparece em três lugares:

- o formulário de nova solicitação, que não deixa avançar e oferece o atalho
  para a grade recortada nos acompanhamentos;
- `criarSolicitacao`, porque a action é um endpoint, e quem chamar direto
  encontra a mesma regra;
- a CHECK constraint `produto_acompanhamento_nao_circular`, que impede o
  cadastro de um produto que seja o próprio acompanhamento que exige.

## Valor nulo não é zero

`Produto.valor` aceita nulo, e seis produtos do catálogo estão assim: são
brindes personalizados comprados em lote, e a planilha veio sem o custo
unitário. O catálogo mostra "valor a definir", R$ 0,00 se leria como grátis, e
a soma do mês passaria a mentir sem ninguém perceber.

O item da solicitação **não** aceita nulo: `valor_unitario` congela na criação,
e produto sem preço congela como zero.

## Histórico é imutável

`solicitacao_historico` recebe uma linha por mudança de status, com autor,
horário e motivo. Nunca é editado nem apagado: é o que responde "por que essa
solicitação parou".

Uma CHECK constraint exige motivo em `deu_problema`, `devolvido` e
`cancelado`.

## Código sequencial

`SOL-2026-0001`, gerado a partir da tabela `contador_codigo` com um UPDATE
atômico dentro da transação que cria a solicitação. Contar linhas existentes
abriria corrida entre dois consultores salvando no mesmo instante.

## Campos da fase 2

`sku_tiny`, `tiny_pedido_id`, `tiny_status`, `rastreio`, `transportadora` e
`salesforce_id` existem desde o V1 e ficam nulos. Ligar as integrações depois
não vai exigir migração de dados.

## Status `cancelado`

A spec lista nove status. O schema tem dez: `cancelado` é exigido por duas
regras do próprio documento, "de Deu problema a solicitação pode voltar para
qualquer status anterior ou ser cancelada" e "o saldo considera todos os status
exceto os cancelados e devolvidos". Sem ele, nenhuma das duas é representável.

## Logística

Quatro tabelas, do módulo de Logística ([ADR 0008](adr/0008-logistica-no-mesmo-app.md)):

| Tabela                      | O que guarda                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `demandas_logistica`        | cada envio da Logística, cadastrado na trilha                   |
| `status_operacional_semana` | o status da semana definido à mão; sem linha, vale o automático |
| `membros_equipe`            | a seção "Equipe" do dashboard                                   |
| `perguntas_frequentes`      | o FAQ                                                           |

A demanda é cadastrada na própria trilha; a tarefa no ClickUp, quando existe,
é um link. Departamento, subsidiária e produto ficam como texto, com sugestão
dos valores já usados, porque a lista ainda está sendo definida pela área.

Custo de envio é `Decimal`, nulo quando não informado. Recorrente tem
periodicidade, e `ocorrencia_anterior_id` é único: uma ocorrência gera uma
próxima, nunca duas. O presente aprovado aponta para a solicitação em
`solicitacao_id`, também único. `ativa = false` é arquivar, nunca apagar.

`fase` usa as oito fases padronizadas da proposta da Logística; `prioridade`,
as quatro do ClickUp, para casar sem tradução.

Restrições no banco: semana ISO entre 1 e 53, custo não negativo, recorrente
com periodicidade, demanda de presente com a solicitação, ocorrência anterior
diferente da própria, e demanda de origem `clickup` com a tarefa de onde veio. O status
manual que volta ao automático anula a situação em vez de apagar a linha.
