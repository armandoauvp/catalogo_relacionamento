# Integração com o Tiny (Olist ERP)

A ferramenta manda pedidos ao Tiny por dois caminhos e traz de volta a
situação e o rastreio de cada um. Substitui a parte de importação e de pedidos
do AUVP-Eventos, com as correções listadas no fim.

| De onde vem o pedido | Quando                                          | Tela                     |
| -------------------- | ----------------------------------------------- | ------------------------ |
| Presente aprovado    | a solicitação chega a "Organizando envio"       | `/tiny`, e a solicitação |
| Envio em lote        | alguém importa uma planilha em `/tiny/importar` | `/tiny/lotes/<lote>`     |
| Nova venda (avulso)  | alguém monta o pedido em `/tiny/nova-venda`     | `/tiny`                  |

Quem opera: **Admin e Logística** (`tiny.operar` em `src/lib/permissions.ts`).

## Ligar

1. **Token.** No Tiny: Menu → Início → Extensões da Olist → instale **Token
   API**; depois Menu → Configurações → aba E-commerce → Token API. Cadastre o
   valor em `TINY_API_TOKEN` na Vercel (Production, Sensitive). Se o Tiny já
   tem um token em uso por outra integração, use o mesmo: gerar outro derruba
   a anterior.
2. **Agendador.** Gere um segredo (`openssl rand -base64 32`) e cadastre o
   mesmo valor em dois lugares:
   - `CRON_SECRET` na Vercel (Production, Sensitive);
   - secret `CRON_SECRET` no GitHub: Settings → Secrets and variables →
     Actions do repositório.

   Se o endereço da produção mudar, ajuste a variável `URL_DA_PRODUCAO` no
   mesmo lugar do GitHub (o padrão é `https://catalogo-logistica.vercel.app`).

3. **SKUs.** Em Administração → Produtos, preencha **SKU no Tiny** de cada
   presente. É obrigatório (pauta de 22/10/2026, responsável: Murilo): o
   cartão "Sem SKU no Tiny" conta o que falta e "Mostrar só estes" filtra.
   Presente com produto sem SKU **não vai**: fica em Falhou com o aviso de
   quais produtos faltam, e o Reenviar o leva depois de preenchido. O presente
   específico, comprado fora do catálogo, não tem SKU e vai pela descrição.
4. **Padrão dos presentes.** Na tela `/tiny`, em "Presentes aprovados":
   transportadora, serviço e marcador. Vazios usam o padrão da conta no Tiny.
5. Publique (Redeploy). A tela `/tiny` deixa de mostrar o aviso amarelo.

## A fila

Nada fala com o Tiny no meio da aprovação nem da importação
([ADR 0009](adr/0009-integracoes-por-fila.md)). Quem cria o pedido grava uma
linha em `pedidos_tiny` na mesma transação e segue. Quem envia é
`processarFila` (`src/lib/tiny/fila.ts`), que roda:

- logo depois de cada aprovação ou importação, em segundo plano (`after()`);
- a cada 10 minutos, pelo GitHub Actions (`.github/workflows/tiny.yml`);
- uma vez por dia, pelo cron da Vercel (`vercel.json`; o plano Hobby não
  permite mais que isso);
- no botão **Processar fila agora**.

Regras, todas em `src/lib/tiny/`:

- **Um pedido por vez, dois segundos entre um e outro.** O Tiny bloqueia por um
  minuto quem passa do limite (códigos 6 e 11); nesse caso o pedido volta para
  a fila e espera.
- **Duas rodadas ao mesmo tempo não duplicam:** cada pedido é reservado com uma
  atualização condicionada ao status.
- **Nova tentativa com espera crescente** (1, 5, 15, 30 e 60 minutos), até 6
  tentativas. Recusa por validação (CEP, cidade, CPF) não é repetida: vira
  **Falhou**, com o motivo do Tiny, e o botão **Reenviar**.
- **Token inválido ou conta bloqueada** param a rodada inteira, para não gastar
  as tentativas dos outros pedidos.
- **Duplicidade** acusada pelo Tiny é tratada como enviado, com aviso: quase
  sempre é um pedido criado numa tentativa que caiu antes da resposta.
- **O token nunca vai ao banco nem ao navegador.** A fila guarda só o pedido.

## O pedido

Montado por `montarPedido` (`src/lib/tiny/pedido.ts`), no formato de
`pedido.incluir.php`:

- **cliente** com `atualizar_cliente: S`: o Tiny cria quem não existe e
  atualiza quem existe, pelo CPF/CNPJ, sem chamada separada de contato;
- **endereço de entrega** com o nome de quem recebe;
- **itens** com o SKU (`codigo`), a descrição, a quantidade e o valor;
- **marcador**, **transportadora** e **serviço** (`forma_frete`);
- **frete por conta do remetente** (`R`). O AUVP-Eventos mandava `E`, que não
  está entre os valores da documentação;
- no presente, o código da solicitação em `numero_pedido_ecommerce`.

Campos acima do tamanho que o Tiny aceita são cortados antes do envio.

## O ciclo de vida

Definido na pauta de 22/10/2026 (regra em `src/lib/tiny/ciclo.ts`):

| Momento                   | Situação no Tiny e aqui | Quem faz                                      |
| ------------------------- | ----------------------- | --------------------------------------------- |
| O pedido nasce            | Em aberto               | a fila, em "Organizando envio" ou no lote     |
| A expedição fecha a lista | Preparando envio        | **Fechar expedição**, na Expedição ou no lote |
| A expedição conclui       | Pronto para envio       | **Concluir**, em cada pedido                  |

- O pedido sempre sai como **Pedido de Venda**: é o que `pedido.incluir` cria,
  e a integração não usa outro tipo.
- Os dois passos vão ao Tiny pela fila (`pedido.alterar.situacao`), sem quem
  clicou esperar. Enquanto não chegam, o selo mostra a situação nova com "a
  caminho do Tiny".
- O passo só anda para a frente. Se alguém já andou o pedido direto no Tiny, a
  sincronização traz a situação de lá e o passo pedido aqui é descartado,
  para não fazer o pedido voltar.
- O que alguém mudar direto no Tiny aparece aqui na próxima sincronização.
- Entradas pelo e-commerce não passam por esta ferramenta: nascem direto no
  Tiny e seguem o fluxo de lá. Ficou como pauta da reunião.

## A volta

`sincronizarPedidos` consulta `pedido.obter.php` dos pedidos que ainda andam,
no máximo a cada 30 minutos cada um e por até 90 dias, e grava situação,
rastreio e nota. No presente, o rastreio vai para a solicitação, onde o
consultor lê; o rastreio digitado à mão só é substituído se o Tiny trouxer
outro. **Rastreio não muda status**: "Entregue" continua decisão de quem
acompanha.

O lote abre uma demanda na trilha do Dashboard Logístico e conclui sozinho
quando todos os pedidos dele chegam a "Entregue" ou "Cancelado" no Tiny.

A situação chega do Tiny como a tela de lá escreve ("Em aberto", "Preparando
envio", "Atendido") e é traduzida para o código (`preparando_envio`) por
`codigoDaSituacao`, em `src/lib/tiny/leitura.ts`, antes de qualquer
comparação. Sem isso, o passo "Concluir" sumia depois da primeira
sincronização.

## Nova venda

`/tiny/nova-venda` monta um pedido avulso, a "Nova venda" do AUVP-Eventos:

- **Cliente** buscado pelo nome ou CPF/CNPJ no Tiny (`contatos.pesquisa.php`,
  com o endereço de lá) e na base de clientes daqui, ou digitado. O CEP
  preenche o endereço. A validação é a mesma da linha do lote.
- **Produtos** do Tiny, quantos forem, com quantidade e preço ajustáveis.
  Sem SKU não vai, como no resto.
- **Transportadora, serviço, marcador** (opcional) e observação.

O pedido entra na mesma fila (`origem = avulso`, com quem montou). A tela gera
uma chave quando abre: dois cliques no enviar devolvem o mesmo pedido.

## Contatos

`/tiny/contatos` busca os clientes do Tiny pelo nome ou CPF/CNPJ
(`contatos.pesquisa.php`) e abre cada um para editar (`contato.obter.php`).
Também cadastra um novo e faz a **atualização cadastral em massa** por
planilha (`/tiny/contatos/importar`), sem gerar pedido: só Nome e CPF/CNPJ são
obrigatórios.

Tudo o que grava vai pela fila, numa tabela própria (`contatos_tiny`), na
mesma rodada e com o mesmo intervalo dos pedidos:

- **Inclui ou altera pelo documento.** Sem o id do Tiny, a fila procura o
  CPF/CNPJ antes: achou, altera; não achou, inclui. Cadastrar quem já existe
  não duplica.
- **Campo vazio não apaga.** Na alteração só vão os campos preenchidos; a
  planilha pode trazer só o que muda.
- **O mesmo CPF/CNPJ esperando a vez é atualizado**, não repetido: vale o dado
  mais novo, numa chamada só.
- A parte de baixo da tela mostra cada gravação, de onde veio, quem mandou e se
  foi incluída, alterada ou recusada, com o Reenviar.

## Da base de clientes ao Tiny

Em Administração → Clientes (Admin), quem opera o Tiny escolhe clientes na
tabela, que pode estar filtrada por etiqueta e período, e:

- **Cadastrar no Tiny**: viram contatos, pela fila de contatos. Quem não tem
  nome e CPF válidos fica de fora, com o motivo.
- **Gerar lote de pedidos**: abre a importação de lote com eles nas linhas,
  cada um com o endereço padrão. Quem não tem endereço completo aparece com o
  erro e se corrige na prévia, como uma linha de planilha.

## Pedidos no Tiny

`/tiny/pedidos` consulta **todos** os pedidos da conta, inclusive os do
e-commerce e os criados direto no Tiny (`pedidos.pesquisa.php`). Uma caixa só
de busca: só dígitos e curto é número do pedido, 11 ou 14 dígitos é CPF/CNPJ,
o resto é nome do cliente. Filtros por situação e período, paginação do
próprio Tiny. O detalhe (`pedido.obter.php`) mostra itens, cliente, entrega,
transporte, rastreio e marcadores, e leva à solicitação ou ao lote quando o
pedido nasceu aqui.

É só leitura, direto da API a cada abertura: nada é guardado, para a tela
nunca divergir do Tiny.

## Estoque no Tiny

`/tiny/estoque` busca o produto pelo nome ou pelo SKU (`produtos.pesquisa.php`)
e abre o saldo de cada um (`produto.obter.estoque.php`): disponível, saldo
geral, reservado e cada depósito, com os que não contam no geral marcados, e
a foto do cadastro de lá. O saldo não vem na busca; buscá-lo linha a linha
estouraria o limite de chamadas. No cadastro de produtos daqui, o SKU leva
direto ao saldo no Tiny.

O estoque do catálogo daqui continua sendo o que decide a rota
(`Produto.origem`); o do Tiny é consulta.

## Importação em lote

`/tiny/importar`: planilha .xlsx ou .csv, uma linha por destinatário.

- **Colunas** achadas pelo nome do cabeçalho, com sinônimos
  (`src/lib/tiny/lote.ts`). Obrigatórias: Nome, CPF/CNPJ, CEP, Endereço,
  Número, Bairro, Cidade, UF. Opcionais: Email, Telefone, Complemento,
  Quantidade (padrão 1), Valor. A planilha do AUVP-Eventos é lida como está; o botão
  "Baixar modelo" gera uma vazia.
- **Prévia** com o erro de cada linha: CPF ou CNPJ inválido ou repetido, CEP
  sem 8 dígitos, UF inexistente, campo obrigatório vazio. Só as linhas certas
  são enviadas; o servidor valida de novo.
- **Corrigir na prévia.** Cada linha tem "Corrigir", que abre os campos com a
  validação ao vivo, e o "x", que a tira do envio. A conferência de CPF/CNPJ
  repetido é refeita a cada mudança. A planilha não é alterada.
- **Preço.** O do cadastro do Tiny vem preenchido e pode ser ajustado para o
  lote. A coluna opcional **Valor** (ou "Preço", a do AUVP-Eventos) vale para
  a própria linha; vazia, vale o preço do lote.
- CPF e CEP que o Excel guardou como número voltam com os zeros da frente.
- **Um produto do Tiny** (busca pelo nome, com o preço do cadastro de lá), uma
  **transportadora** e um **marcador** para todas as linhas.
- **Sem duplicar:** a chave de cada pedido é marcador + CPF/CNPJ + SKU.
  Importar a mesma planilha de novo pula quem já recebeu e diz quem foi pulado.

## O que mudou em relação ao AUVP-Eventos

| No AUVP-Eventos                                     | Aqui                                                  |
| --------------------------------------------------- | ----------------------------------------------------- |
| Reimportar a planilha duplicava os pedidos          | chave por marcador, CPF e SKU                         |
| A linha ficava em "Fila" para sempre                | cada linha mostra o pedido criado ou o motivo do erro |
| A fila só andava com a aba aberta                   | agendador, `after()` e botão                          |
| Token em texto puro na fila e entregue ao navegador | só no servidor, em variável de ambiente               |
| Rota de processamento aberta                        | exige `CRON_SECRET`                                   |
| Permissão de importar existia mas não era conferida | `tiny.operar`, conferida no servidor                  |
| Status e rastreio nunca voltavam                    | sincronização a cada rodada                           |
| Colunas lidas pela posição                          | lidas pelo nome, com sinônimos                        |

## Testar sem o Tiny

Os testes de `src/lib/tiny/` cobrem a montagem do pedido, a leitura da
planilha, a classificação de erros e as esperas. Para ponta a ponta sem
token real, aponte `TINY_API_BASE_URL` para um servidor que imite a API v2 e
use um token qualquer.
