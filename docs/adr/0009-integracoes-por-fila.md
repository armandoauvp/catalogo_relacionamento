# 0009: Integrações externas por fila no banco

**Estado:** decidida, revista em 09/10/2026.

**Revisão:** a trilha da Logística passou a ser cadastrada aqui dentro, e não
no ClickUp. A demanda do presente aprovado deixou de ser integração externa:
ela nasce na própria transação da mudança de status
(`src/lib/logistica/ponte.ts`), sem fila. A fila continua valendo para o que é
de fato externo, o pedido no Tiny. O texto abaixo é o da decisão original.

## Contexto

A solicitação aprovada precisa virar duas coisas fora daqui:

- uma **tarefa no ClickUp**, na aprovação, para a Logística ver a demanda e a
  previsão desde cedo;
- um **pedido no Tiny**, quando a solicitação chega a "Organizando envio", com
  tudo comprado e pronto para despachar. Do Tiny volta o rastreio.

Chamar as duas APIs no meio da aprovação faria a aprovação depender delas. O
ClickUp fora do ar, um token vencido ou o limite de requisições do Tiny (30
por minuto) travariam o Admin, que aprova por pilha.

O AUVP-Eventos já resolve isso com uma fila, mas em memória e drenada pelo
navegador: o limite de taxa não sobrevive a duas réplicas, e a fila só anda
com alguém com a tela aberta.

## Decisão

Toda chamada a sistema externo vira uma linha numa tabela de fila, gravada na
**mesma transação** que muda o status da solicitação. Um processador separado
lê a fila, chama a API, guarda o identificador externo e marca a linha como
feita.

- **Idempotente:** a linha guarda o que já foi criado lá fora; repetir não
  duplica tarefa nem pedido.
- **Com nova tentativa:** falha temporária volta para a fila com espera
  crescente. Falha definitiva, como um CPF recusado pelo Tiny, para e aparece
  numa tela para quem acompanha, com o erro e um botão de tentar de novo.
- **Sem depender de tela aberta:** o processador roda por agendamento, uma
  rota protegida por segredo chamada pelo agendador da TI, e também logo
  depois da mudança de status, como atalho.
- **Limite de taxa no banco**, contado pela própria fila, e não em memória.

## Consequências

A aprovação nunca espera nem falha por causa do ClickUp ou do Tiny. O que
falhou fica visível, com motivo, em vez de sumir num log.

Em troca, a tarefa e o pedido aparecem lá fora alguns segundos depois da
aprovação, e não no mesmo instante. E a TI passa a ter um agendamento a manter
(ver [entrega para a TI](../10-entrega-ti.md)).
