# Conferência do fornecedor

Pedido da Lilian em 25/11/2026: o catálogo seguia oferecendo vinho que a Casa
da Bebida não tinha mais, e o preço daqui envelhecia sem ninguém ver.

## O que acontece

Toda manhã o servidor abre o link de compra (`Produto.urlCompra`) de cada
presente ativo e grava o que a loja publica: preço e disponibilidade
(`src/lib/conferencia-do-fornecedor.ts`). A leitura é pelos dados
estruturados da página (schema.org `Product`, em JSON-LD ou em meta tags), que
é o que buscadores leem e por isso muda pouco; o desenho da página não importa
(`src/lib/oferta-do-fornecedor.ts`).

- **Agenda:** `.github/workflows/fornecedores.yml`, às 7h e 7h20 de Brasília,
  chama `/api/fornecedores/cron` com o mesmo `CRON_SECRET` do Tiny. A segunda
  chamada pega o que não coube nos 60 s da primeira. Produto conferido há
  menos de 20 horas fica para o dia seguinte.
- **Na hora:** o Admin aperta "Conferir agora" na linha do produto, em
  Administração → Produtos. Trocar o link apaga a leitura anterior.

## O que muda na tela

- **Consultor** (catálogo e nova solicitação): o selo "esgotado na loja".
  Avisa e não trava: a loja pode repor, e o Financeiro pode comprar em outra.
- **Admin** (Produtos): o cartão "Esgotados na loja", que filtra a tabela, e
  em cada linha a situação, o preço da loja quando difere do daqui, "Usar
  R$ X" e "Conferir agora".

## O que ela não faz, de propósito

- **Não troca preço sozinha.** O preço da loja pode ser só de uma parte do kit
  (o link do kit de cerveja é a cerveja), e o daqui pode incluir frete. "Usar
  R$ X" é decisão do Admin, e solicitação já feita não muda: o valor congelou
  na criação.
- **Não desativa presente.** Esgotado é aviso; pausar é o Admin.
- **Não lê variação** (safra, tamanho, cor). Cada loja organiza de um jeito;
  fica para uma segunda etapa, se a área precisar.

## Lojas que não dá para ler

Página que não publica dados estruturados, ou que não respondeu, fica "loja
não conferida", com o motivo. Na primeira rodada (25/11/2026):

| Loja               | Resultado                                      |
| ------------------ | ---------------------------------------------- |
| Casa da Bebida     | preço e estoque lidos (21 itens, 15 esgotados) |
| Colombina          | preço e estoque lidos; um link quebrado (404)  |
| Mercado Livre      | não publica para leitura automática            |
| Roberta Decorações | não publica para leitura automática            |

O servidor só abre endereço de loja: link para endereço interno
(`localhost`, rede privada) é recusado sem ser aberto.
