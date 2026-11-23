# Histórico do rastreio (Correios)

O código de rastreio vem do Tiny ou é digitado na Expedição. Com ele, a
ferramenta busca nos Correios o histórico do objeto e mostra a linha do tempo:
postado, em transferência, saiu para entrega, entregue. É a mesma lista que a
tela de rastreio do Tiny mostra, e o Tiny também a busca nos Correios: a API do
Tiny só devolve o código e o link.

| Onde aparece                       | Quem vê                      |
| ---------------------------------- | ---------------------------- |
| Detalhe da solicitação, "Rastreio" | consultor e Admin            |
| Tiny → Pedidos no Tiny → um pedido | Admin e Logística            |
| Expedição, ao lado de "Entregue"   | aviso quando já foi entregue |

## Regras

- **Rastreio não muda status.** O evento de entrega dos Correios só acende um
  aviso ("Os Correios registraram a entrega em..."); quem marca "entregue" é a
  expedição, como sempre (`marcarEntregue`).
- **Só Correios.** Código no formato `AA123456789BR`. Outras transportadoras
  (Total Express) ficam só com o código e o link.
- **Só se soma.** Cada consulta grava os eventos novos
  (`eventos_de_rastreio`, único por objeto + data + código + tipo). Objeto
  entregue não é mais consultado.
- **Quando consulta:** no agendador do Tiny (`/api/tiny/cron`), no botão
  "Atualizar rastreios" da tela do Tiny e, quando alguém abre a tela com o
  histórico com mais de uma hora, logo depois da resposta, sem a tela esperar.
- **Credenciais só no servidor**, nunca no banco nem no navegador.

Código em `src/lib/rastreio/`: `leitura.ts` (formato da resposta, entrega),
`correios.ts` (token e consulta), `sincronizar.ts` (o que consultar e gravar).

## Ligar

1. **Credenciais do CWS.** Quem cuida do contrato com os Correios entra em
   [cws.correios.com.br](https://cws.correios.com.br) com o usuário do
   contrato da AUVP e, em **Gestão de acesso a API's**, gera o **código de
   acesso às APIs**. Anote também o **número do cartão de postagem** (o mesmo
   das etiquetas) e confira se a **API Rastro** está liberada para o contrato.
2. **Na Vercel** (Settings → Environment Variables, Production, Sensitive):
   - `CORREIOS_USUARIO`: o usuário do Meu Correios com que se entra no CWS
     (o Swagger da API Token chama o código de acesso de "senha" desse
     usuário);
   - `CORREIOS_CODIGO_ACESSO`: o código de acesso gerado no passo 1;
   - `CORREIOS_CARTAO_POSTAGEM`: o número do cartão de postagem.
3. **Redeploy** (Deployments → ⋯ no mais recente → Redeploy): variável nova só
   vale depois dele.
4. Em **Tiny**, clique em **Atualizar rastreios**. A mensagem diz quantos
   rastreios foram consultados; credencial errada aparece em vermelho, com o
   motivo.

## O formato da resposta

O Swagger da API Rastro só abre logado no CWS. A leitura usa os nomes que as
integrações conhecidas usam (`objetos[].eventos[]` com `codigo`, `tipo`,
`dtHrCriado`, `descricao`, `unidade.tipo`, `unidade.endereco.cidade/uf`) e é
tolerante: campo que falta vira vazio, evento sem data é descartado. Se a
primeira consulta real mostrar "O histórico dos Correios aparece aqui na
próxima atualização" para um objeto que tem eventos, o formato mudou: compare a
resposta com `src/lib/rastreio/leitura.ts`. `CORREIOS_API_URL` troca o
endereço (o padrão é `https://api.correios.com.br`).
