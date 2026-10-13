# Logística

O módulo do time de Logística: o Dashboard Logístico em `/logistica`, com a
trilha de demandas cadastrada pela própria Logística, e a ponte que leva o
presente aprovado até a trilha. Por que é um módulo desta aplicação: [ADR 0008](adr/0008-logistica-no-mesmo-app.md).

## De onde vem

Dois documentos da área, guardados fora do repositório:

- **Proposta de Dashboard Logístico**: um painel "simples, visual e prático",
  com leitura rápida por qualquer colaborador, da operação à diretoria. O
  detalhamento operacional continua no ClickUp.
- **1º Relatório de Melhorias**: a primeira rodada sobre o protótipo.
- **Áudios de 09/10/2026**, da Logística, que fecharam três pontos:
  - a trilha é **manual**: não espelha o ClickUp, e a tarefa lá, quando
    existe, é só um link;
  - **horas saem**: medir o esforço de forma justa custaria mais do que vale;
  - **recorrentes** são 50 a 60% do trabalho e precisam aparecer.

O protótipo não tinha código. Tudo aqui foi construído do zero.

## O que o painel mostra

| Pedido da área                                                                | Onde                                               | Situação   |
| ----------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| Filtro global: semanal, mensal, anual ou datas livres (relatório, item 3)     | `src/lib/periodo.ts`                               | pronto     |
| Status operacional em destaque: normal, alto volume, risco, crítica (item 1)  | dashboard                                          | pronto     |
| "Volume de Pedidos por Departamento", com subsidiária e departamento (item 2) | dashboard, em quantidade e em custo                | pronto     |
| Comparativo com o período anterior e evolução semanal (proposta, item 1)      | dashboard                                          | pronto     |
| Trilha de demandas com a esteira prioritária dentro dela (item 4)             | dashboard                                          | pronto     |
| Cadastro manual da trilha, com os campos da proposta (item 4) e dos áudios    | "Nova demanda" e "Editar" na trilha                | pronto     |
| Status, item ou "Kit", observações no hover, previsão obrigatória (item 4)    | trilha                                             | pronto     |
| Exportar a trilha respeitando o filtro de período (item 4)                    | trilha                                             | pronto     |
| Link para a tarefa no ClickUp, quando existe (item 5)                         | título da demanda                                  | pronto     |
| Tarefas recorrentes, com a próxima ocorrência automática                      | trilha e números                                   | pronto     |
| Presente aprovado entra sozinho na trilha                                     | `src/lib/logistica/ponte.ts`                       | pronto     |
| Link para os produtos que a AUVP tem fisicamente                              | catálogo, filtro "Só em estoque"                   | pronto     |
| Apresentação da equipe (item 6)                                               | `/logistica/equipe`                                | pronto     |
| FAQ (item 7)                                                                  | `/logistica/faq`                                   | pronto     |
| Fases operacionais padronizadas (proposta, item 5)                            | enum no schema                                     | pronto     |
| Horas por produto (proposta, item 2)                                          | -                                                  | abandonado |
| Presente aprovado vira pedido no Tiny                                         | fila, [ADR 0009](adr/0009-integracoes-por-fila.md) | depois     |

Equipe e FAQ são preenchidos pela própria Logística, nas telas de cada um.

## Como o painel conta

Regras em `src/lib/logistica/`, puras e testadas, com a leitura do banco à
parte em `painel.ts`:

- **Volume** é o que foi _pedido_ no período (`solicitadaEm`), que na trilha
  manual é o dia do cadastro. O comparativo é com o período anterior do mesmo
  tamanho, e os números separam recorrentes de pontuais.
- **Custo** é a soma do custo de envio informado. Demanda sem custo não entra
  na soma, e o painel diz quantas faltam, para um departamento com metade dos
  custos em branco não parecer barato. O gráfico por departamento troca entre
  quantidade e custo (`?ver=valor`).
- **O gráfico de volume é de barras**, e não a rosca do protótipo. Comparar
  fatias de rosca é adivinhação; comprimento de barra se lê. Cada barra traz
  quantidade e percentual, então a tabela que ficava embaixo da rosca deixou
  de ser necessária. Uma cor só, porque o que se compara é tamanho.
- **A trilha** mostra o que esteve _em andamento_ em algum momento do período:
  pedido antes do fim e não concluído antes do início. Por isso a trilha de uma
  semana inclui o que vem aberto de semanas anteriores. Ordem: abertas antes
  de concluídas; dentro das abertas, prioritárias (urgente e alta), atrasadas
  antes; depois pela previsão mais próxima, com a demanda sem previsão no fim
  do seu grupo. A tela mostra até 200; a exportação leva todas.
- **Atrasada** é a demanda aberta com a previsão de conclusão vencida.
  **Sem previsão** aparece como aviso na trilha, porque a área considera a
  previsão obrigatória.
- **"Kit"**: mais de um item na demanda. A lista completa abre no hover.
- **Previsão de início** é opcional e só aparece na trilha enquanto a demanda
  não começou (Recebido e Em análise); depois, a data que vale é a de
  finalização. É a resposta a "não fica redundante?", da Logística.
- **Concluir** grava a data de conclusão; voltar de "Concluído" apaga.
- **Recorrente** tem periodicidade (semanal, quinzenal, mensal). Ao concluir,
  a próxima ocorrência nasce sozinha, com as previsões um período adiante, ou
  mais de um, se a anterior foi concluída tão tarde que a próxima já venceu.
  O banco garante uma próxima só, mesmo que a conclusão seja salva de novo.
- **Arquivar** tira a demanda do painel inteiro sem apagar. É o caminho para o
  que foi cadastrado por engano e para o presente cancelado.
- **O status da semana** vale para a semana selecionada, ou para a semana
  atual quando o filtro é mês, ano ou personalizado. Sugestão automática, a
  mais grave que se aplica:

  | Situação         | Quando                                                      |
  | ---------------- | ----------------------------------------------------------- |
  | Operação crítica | 3 ou mais atrasadas, ou 2 ou mais que sejam 25% das abertas |
  | Risco de atraso  | ao menos 1 atrasada                                         |
  | Alto volume      | 10 ou mais pedidos e 1,5× a média das 8 semanas anteriores  |
  | Operação normal  | nenhuma das anteriores                                      |

  A Logística pode definir à mão, com um porquê, e voltar ao automático. O
  painel diz quem definiu e quando, e mostra ao lado o que os números sugerem.
  Os limiares são suposição, ver [perguntas em aberto](05-perguntas-em-aberto.md#logística),
  e moram em `LIMIARES`, em `status-operacional.ts`.

- **As observações** só chegam ao navegador de quem pode lê-las: o filtro é
  no servidor, na tela e na exportação.

## A ponte com os presentes

O presente aprovado entra na trilha sozinho, na mesma transação da mudança de
status, e cada status seguinte move a fase (`src/lib/logistica/ponte.ts`):

| Status do presente             | Fase na trilha         |
| ------------------------------ | ---------------------- |
| Pendente, aguardando aprovação | ainda não entra        |
| Aguardando compra              | Aguardando suprimentos |
| Comprado                       | Recebido               |
| Organizando envio              | Em execução            |
| Entregue, cliente confirmou    | Concluído              |
| Deu problema, devolvido        | Revisão                |
| Cancelado                      | arquivada              |

Ela nasce com o selo "Presente", o código e o cliente no título, os itens e
uma previsão de 7 dias (15 quando ainda há compra). O endereço não vai para a
trilha: ele está na Expedição. Subsidiária, departamento e prazos são
suposição, em `PONTE`.

## Dados de exemplo

`npm run db:seed` cria cerca de 115
demandas **fictícias** em 14 semanas (`prisma/exemplo-logistica.ts`), com
datas relativas a hoje, três membros de equipe inventados e um status manual
no histórico. Departamentos e subsidiárias são ilustrativos. A carga de
produção (`db:catalogo`) não leva nada disso.

## O período

Um só período vale para o painel inteiro e para a exportação, e mora na URL:

| Tipo          | URL                                                   | Cobre                         |
| ------------- | ----------------------------------------------------- | ----------------------------- |
| Semanal       | `?periodo=semana&ref=2026-W34`                        | segunda a domingo, semana ISO |
| Mensal        | `?periodo=mes&ref=2026-08`                            | dia 1 ao último dia           |
| Anual         | `?periodo=ano&ref=2026`                               | 1º de janeiro a 31/12         |
| Personalizado | `?periodo=personalizado&de=2026-08-01&ate=2026-08-31` | as duas datas, inclusive      |

Regras, todas em `src/lib/periodo.ts` e cobertas por teste:

- **Semana ISO**, numerada como a área escreve, `2026-34`. A semana é do ano da
  sua quinta-feira: 01/01/2027, uma sexta, ainda é a `2026-53`.
- **Calendário de São Paulo.** Domingo às 23h ainda é a semana que termina,
  mesmo já sendo segunda em UTC.
- **Trocar de tipo mantém o ponto.** Quem olha a semana 34 e clica em "Mensal"
  vai para agosto, não para o mês de hoje.
- **Anterior e próximo** andam uma unidade do tipo; no personalizado, andam o
  mesmo número de dias, para comparar igual com igual.
- **Endereço inválido não quebra a tela:** volta para a semana atual e avisa.
- O personalizado vai até três anos.

## Perfis

Ver [perfis e permissões](02-perfis-e-permissoes.md#perfil-logística). Todo
perfil lê o dashboard; Logística e Admin cadastram e editam as demandas, cuidam
do status manual, da equipe e do FAQ, e são os únicos que leem as observações.

## O que depende da área

Ver [perguntas em aberto](05-perguntas-em-aberto.md#logística).
