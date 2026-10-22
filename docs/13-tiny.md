# Integração com o Tiny (Olist ERP)

A ferramenta manda pedidos ao Tiny por dois caminhos e traz de volta a
situação e o rastreio de cada um. Substitui a parte de importação e de pedidos
do AUVP-Eventos, com as correções listadas no fim.

| De onde vem o pedido | Quando                                          | Tela                     |
| -------------------- | ----------------------------------------------- | ------------------------ |
| Presente aprovado    | a solicitação chega a "Organizando envio"       | `/tiny`, e a solicitação |
| Envio em lote        | alguém importa uma planilha em `/tiny/importar` | `/tiny/lotes/<lote>`     |

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
   presente. Item sem SKU vai ao Tiny só pela descrição, sem baixar estoque.
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

## A volta

`sincronizarPedidos` consulta `pedido.obter.php` dos pedidos que ainda andam,
no máximo a cada 30 minutos cada um e por até 90 dias, e grava situação,
rastreio e nota. No presente, o rastreio vai para a solicitação, onde o
consultor lê; o rastreio digitado à mão só é substituído se o Tiny trouxer
outro. **Rastreio não muda status**: "Entregue" continua decisão de quem
acompanha.

O lote abre uma demanda na trilha do Dashboard Logístico e conclui sozinho
quando todos os pedidos dele chegam a "Entregue" ou "Cancelado" no Tiny.

## Importação em lote

`/tiny/importar`: planilha .xlsx ou .csv, uma linha por destinatário.

- **Colunas** achadas pelo nome do cabeçalho, com sinônimos
  (`src/lib/tiny/lote.ts`). Obrigatórias: Nome, CPF/CNPJ, CEP, Endereço,
  Número, Bairro, Cidade, UF. Opcionais: Email, Telefone, Complemento,
  Quantidade (padrão 1). A planilha do AUVP-Eventos é lida como está; o botão
  "Baixar modelo" gera uma vazia.
- **Prévia** com o erro de cada linha: CPF ou CNPJ inválido ou repetido, CEP
  sem 8 dígitos, UF inexistente, campo obrigatório vazio. Só as linhas certas
  são enviadas; o servidor valida de novo.
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
