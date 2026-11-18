# Fluxo de status

Fonte única: [`src/lib/status.ts`](../src/lib/status.ts), coberta por
`status.test.ts`.

## Fluxo linear

```
Pendente
  → Aguardando aprovação
    → Aguardando compra
      → Comprado
        → Organizando envio
          → Entregue / rastreio finalizado
            → Cliente confirmou recebimento
```

Avança uma etapa por vez. Não é possível pular etapa nem voltar pelo caminho
linear: voltar acontece por "Deu problema".

### A compra é por item

O Financeiro compra por fornecedor: a fila de compras abre agrupada por loja
(`agruparPorFornecedor`, com o fornecedor tirado do link de cada item em
`fornecedorDoItem`), para comprar de uma vez e juntar o frete. Como uma
solicitação pode ter itens de lojas diferentes, a marca de comprado é do item
(`SolicitacaoItem.compradoEm`, com quem comprou). A solicitação vai sozinha a
**Comprado** quando o último item que precisa de compra é marcado
(`compraCompleta`), com a linha no histórico; o item de estoque não conta.
Marcar a solicitação inteira, pelo detalhe, registra os itens que faltavam.

### Comprado não é chegado

O Financeiro marca **Comprado** quando faz a compra, mas o item ainda vai
chegar. A Logística só processa o que está com ela, então o passo seguinte,
**Comprado → Organizando envio**, é dela: na Expedição, o pedido fica "a
caminho" até alguém clicar em "Chegou" com o item na mão (confirmarChegada,
permissão xpedicao.receberItem). É esse clique que manda o presente para a
fila da expedição e para o Tiny. Antes, o Financeiro "liberava para envio" no
momento da compra, e o pedido entrava no Tiny sem o item, sem nenhum aviso de
quando voltar nele.

O aviso agora existe: o que acabou de ficar pronto ganha o selo "Novo" na
Expedição por 24 horas, o item "Expedição" do menu mostra quantos estão prontos
para processar, e o painel da Logística mostra prontos e a caminho. Na trilha,
o presente comprado fica em "Aguardando suprimentos" até chegar.

### Atalho: estoque não passa pelo Financeiro

Há uma exceção declarada em `ATALHOS`: de **Aguardando aprovação** a
solicitação pode ir direto para **Organizando envio**, pulando o Financeiro.

O atalho **parte da aprovação**, e é isso que importa: ele pula o Financeiro,
nunca a aprovação. Nada sai do pedido do consultor direto para a expedição,
alguém precisa dar o OK antes, e é esse OK que libera o envio.

Regra da área: item que já está na prateleira não tem o que ser comprado, e
hoje esses casos vão para a expedição por fora do sistema. Quem decide se o
atalho é oferecido é `proximoDepoisDaAprovacao(itens)`, que olha os itens:

| Item                                 | Precisa de compra |
| ------------------------------------ | ----------------- |
| Presente específico                  | sim               |
| Produto que não controla estoque     | sim               |
| Produto que controla e não tem saldo | sim               |
| Produto que controla e tem saldo     | não               |

Basta um item precisar de compra para a solicitação inteira ir ao Financeiro: o
pedido é embalado junto, então ele espera o item que falta.

A tela do detalhe **sugere** o próximo status e explica o porquê; a decisão
continua sendo do Admin, e as duas transições são válidas.

### Encaminhamento em lote

O Admin trabalha por pilha: chegam vinte pedidos e ele decide de uma vez quais
vão comprar e quais já podem ser separados. A tela de gestão tem seleção por
linha e três ações, "Aprovar e encaminhar" (roteia pelo estoque), "Mandar
comprar" e "Liberar para envio". O lote também não pula a chegada: o que está em
"Comprado" só vai para a expedição pelas mãos de quem pode confirmar que o item
chegou; para os demais, volta na lista de ignoradas com o motivo.

Quem monta o caminho é `caminhoDeEncaminhamento`, e ela não afrouxa nada:

- quando a solicitação ainda está **pendente**, o passo da aprovação entra
  antes do destino, e vira uma linha própria do histórico. Não existe salto de
  "pedido" para "liberado" sem o OK registrado;
- cada salto passa por `transicaoPermitida`, a mesma função da tela de
  detalhe;
- o que não pode andar não anda em silêncio: volta na lista de ignoradas, com
  o motivo.

A coluna "rota" da tabela diz, antes do clique, se aquela solicitação tem o que
comprar: é o que evita abrir vinte telas para decidir.

## Saídas do fluxo

- **Deu problema**: acionável a partir de qualquer status vivo. Dali a
  solicitação volta para qualquer etapa anterior ou é cancelada.
- **Devolvido**: só a partir de "Entregue" em diante.
- **Cancelado**: acionável a partir de qualquer status vivo.

## Status finais

"Cliente confirmou recebimento", "Devolvido" e "Cancelado" não admitem
mudança. A tela do Admin diz isso em vez de oferecer um seletor vazio.

## Motivo obrigatório

"Deu problema", "Devolvido" e "Cancelado" exigem motivo preenchido, gravado no
histórico. Exigido em três camadas: no seletor da tela, em
`validarMudancaDeStatus` e numa CHECK constraint do banco.

## Quem muda

Admin e Financeiro. O consultor acompanha, e dá um passo só: com a
solicitação dele em "Entregue", o botão "Meu cliente recebeu" a leva a
"Cliente confirmou recebimento" (`confirmarRecebimento`, permissão
`solicitacao.confirmarRecebimento`). É ele quem fala com o cliente. A Logística
marca "Entregue" pela expedição, mas não confirma pelo cliente.

## Status é da solicitação, não do item

Uma solicitação com três itens tem um status só. Se um item der problema, o
Admin usa observações e histórico.

**Vale confirmar com a área se isso atende**, está registrado em
[perguntas em aberto](05-perguntas-em-aberto.md). Se não atender, a mudança é
de porte médio: o status desce para `solicitacao_itens` e o status da
solicitação passa a ser derivado dos itens.

## Efeito no saldo

**Todos os status entram no gasto do mês**, cancelados e devolvidos inclusive.

A spec v1 dizia para excluir os dois, e o código chegou a fazer isso. A área
corrigiu: uma devolução normalmente vira reenvio, então o dinheiro segue
comprometido, e tirar esses casos da conta subestimaria o gasto do consultor.

`STATUS_FORA_DO_SALDO` continua existindo, vazia. Ela é o lugar único da
pergunta "isto conta no saldo?": se um dia algum status deixar de contar, ele
entra ali e a mudança vale de uma vez para o saldo, o painel e a exportação.

## Rastreio

`Solicitacao.rastreio` e `Solicitacao.transportadora` são preenchidos na tela
da expedição (`expedicao.registrarRastreio`) e lidos pelo consultor na lista e
no detalhe da própria solicitação.

Gravar o rastreio **não muda o status**: pôr o código é dizer que saiu, e
"entregue" é outra coisa, decidida por quem acompanha. São dois botões, e o de
entregue só aparece depois que há código.

Os campos já existiam reservados para a fase 2. Quando a integração com o Tiny
ou com o sistema da expedição existir, ela escreve nos mesmos campos e o
formulário vira o caminho manual de exceção, nada muda nas telas de leitura.

## Da expedição para a frente

"Organizando envio" é o status em que a solicitação está com a expedição. A
tela `/expedicao` monta a partir dele a lista que hoje é uma planilha feita à
mão: ver [`src/lib/expedicao.ts`](../src/lib/expedicao.ts).

A expedição não é um perfil novo: ela trabalha fora desta ferramenta, e quem
abre a tela é Admin ou Financeiro (`expedicao.verFila`). A carta que acompanha
o presente continua sendo escrita fora do sistema, por decisão da área.
