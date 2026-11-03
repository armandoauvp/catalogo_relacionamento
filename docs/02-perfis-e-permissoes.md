# Perfis e permissões

Fonte única: [`src/lib/permissions.ts`](../src/lib/permissions.ts). Menu,
guarda de rota e server action consultam a mesma tabela, para que esconder um
botão e bloquear a ação nunca divirjam.

## Matriz

| Ação                                      |    Consultor    | Admin | Financeiro | Logística |
| ----------------------------------------- | :-------------: | :---: | :--------: | :-------: |
| Ver catálogo                              |        ✓        |   ✓   |     ✓      |     ✓     |
| Criar solicitação                         |        ✓        |   ✓   |     -      |     -     |
| Ver as próprias solicitações              |        ✓        |   ✓   |     ✓      |     -     |
| Ver todas as solicitações                 |        -        |   ✓   |     ✓      |     -     |
| Ver a fila de compras                     |        -        |   ✓   |     ✓      |     -     |
| Ver a fila da expedição e anotar rastreio |        -        |   ✓   |     ✓      |     ✓     |
| Ver dados sensíveis do cliente            | só das próprias |   ✓   |    ✓ ¹     |     ✓     |
| Alterar status                            |        -        |   ✓   |     ✓      |     -     |
| Editar/corrigir solicitação               |        -        |   ✓   |     -      |     -     |
| Gerenciar catálogo, categorias e usuários |        -        |   ✓   |     -      |     -     |
| Exportar solicitações                     |        -        |   ✓   |     ✓      |     -     |
| Ver saldo gasto                           |     próprio     | todos |   todos    |     -     |
| Ver o Dashboard Logístico                 |        ✓        |   ✓   |     ✓      |     ✓     |
| Ler as observações das demandas           |       - ²       |   ✓   |    - ²     |     ✓     |
| Definir o status da semana, equipe e FAQ  |        -        |   ✓   |     -      |     ✓     |

¹ Único ponto do perfil Financeiro ainda sem confirmação da área. Ver abaixo.

² Suposição: as observações vêm do ClickUp em texto livre e é ali que aparecem
nome e endereço de quem recebe. Isolado em `PENDENTE_CONFIRMACAO`.

## Um admin por área

A coluna Admin acima é o **Admin geral**, o único que promove alguém a admin. Ao
lado dele há um admin para cada área:

| Ação                                  | Admin Relacionamento |    Admin Logística    |
| ------------------------------------- | :------------------: | :-------------------: |
| Aprovar e mudar status de solicitação |          ✓           |           -           |
| Criar solicitação                     |          ✓           |           -           |
| Ver todas as solicitações             |          ✓           |      só leitura       |
| Catálogo, modelos e guia da carta     |          ✓           |           -           |
| Clientes                              |          ✓           |           -           |
| Ver o saldo de todos e exportar       |          ✓           |           -           |
| Fila de compras                       |      só leitura      |           -           |
| Fila da expedição                     |      só leitura      |   ✓, anota rastreio   |
| Dashboard Logístico                   |      só leitura      |      ✓, gerencia      |
| Tiny                                  |          -           |           ✓           |
| Em Usuários, alcança quem é           |      Consultor       | Consultor e Logística |
| Trocar perfil de quem alcança         |          -           | Consultor ↔ Logística |
| Definir o limite mensal               |          ✓           |           -           |
| Ativar e desativar quem alcança       |          ✓           |           ✓           |

O alcance vale nos dois sentidos (`perfisAoAlcance`): o admin só mexe em quem
está num dos perfis dele e só atribui um deles. É isso que impede o Admin de
Logística de rebaixar outro admin ou tirar alguém do Financeiro. `salvarUsuario`
confere contra o perfil gravado, e a consulta da tela nem traz os demais.

Marcar como comprado e liberar o que foi comprado pedem `compras.operar`
(`ehPassoDeCompra`), do Financeiro e do Admin geral. O Admin de Relacionamento
continua podendo aprovar, cancelar e registrar problema.

`BOOTSTRAP_ADMIN_EMAILS` só promove quem ainda é Consultor: quem recebeu um perfil
de área na tela de Usuários não volta a Admin geral no login seguinte. Com
`PERFIL_LIVRE` ligado, qualquer pessoa ainda escolhe qualquer perfil no menu da
conta, então a separação só vale de verdade com a variável desligada.

## Perfil Financeiro

A spec deixou esse perfil "a definir". A área definiu depois:

> Recebe as solicitações enviadas para compra contendo data, produto, valor e
> site. Consegue alterar o status do pedido.

Foi implementado assim:

- **Fila de compras** (`/financeiro/compras`): lista por item, e não por
  solicitação, porque a compra acontece item a item, um pedido com três
  presentes pode ter três origens. Traz data, produto, valor e site. O "site" é
  o link do presente específico; item de catálogo não tem site, e no lugar
  aparece a categoria.
  Item de catálogo também mostra site quando a categoria tem fornecedor fixo,
  bebida é sempre comprada na Casa da Bebida, por regra da área
  (`src/lib/fornecedores.ts`). O link do presente específico vence o padrão da
  categoria, porque foi escolhido para aquele item.
- **Alteração de status**: liberada, com as mesmas transições e as mesmas
  exigências de motivo que valem para o Admin.

## Perfil Logística

Entrou com o Dashboard Logístico ([ADR 0008](adr/0008-logistica-no-mesmo-app.md)).
O time de Logística é quem separa e posta, então a fila da expedição e o
registro de rastreio, que antes eram de Admin e Financeiro por falta de quem
operasse dentro da ferramenta, passam a ser também dele. O endereço de envio
está nessa fila, e por isso o perfil vê dados sensíveis do cliente.

O que o perfil não faz: criar ou acompanhar solicitação de presente, mexer em
status, catálogo, cliente ou usuário. O escopo de solicitações dele é
**nenhum**, e não "todas": a home manda quem tem escopo nenhum para
`/logistica`, em vez de mostrar um resumo que não lhe cabe.

O Dashboard Logístico é leitura para todos os perfis, porque a proposta pede
"leitura rápida por qualquer colaborador, desde operação até diretoria".

O acesso a dados sensíveis do cliente pelo Financeiro segue liberado por
coerência com a permissão de exportar, já que a exportação definida na spec
carrega CPF, telefone e endereço. Está isolado em `PENDENTE_CONFIRMACAO`: se a
área quiser restringir, é a troca de uma linha, e ela vale nos dois lugares de
uma vez.

## Escopo de leitura

Permissão sozinha não basta: o consultor pode "ver solicitações", mas só as
dele. Isso é o escopo, e ele vira filtro de banco em `filtroDeSolicitacoes`.

Nenhuma tela escreve o `where` de consultor à mão. O critério de aceite "o
consultor só enxerga as próprias solicitações" não pode depender de quem
escreveu a query.

## Onde a autorização acontece

Sempre no servidor:

- `exigirUsuario()`: exige sessão;
- `exigirPermissao(acao)`: exige uma permissão, redireciona quem não tem;
- `autorizarAction(acao)`: versão para server action e rota de API, que lança
  em vez de redirecionar.

O middleware só checa a existência do cookie de sessão. Ele roda no edge e não
enxerga perfil; serve para evitar renderizar página autenticada à toa, não para
autorizar.
