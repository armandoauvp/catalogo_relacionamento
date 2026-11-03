# Identidade visual

A identidade não é decidida neste repositório. Ela vem do **Design System AUVP
Capital**, que mora em [`ProdutosAUVP/central`](https://github.com/ProdutosAUVP/central)
e está publicado em <https://produtosauvp.github.io/central/design-system>.

Aqui os tokens são **portados**, não reinventados: os valores HSL são os mesmos
da Central, incluindo as correções de contraste documentadas lá.

## Onde os tokens moram

`src/styles/auvp-tokens.css`: arquivo único, importado por dois consumidores:

- `src/app/globals.css`, a aplicação;
- `demo/tailwind.css`, a vitrine estática.

Ficam juntos de propósito. A identidade não pode divergir entre o que a área
aprova na vitrine e o que ela usa no sistema.

## O que foi traduzido

A Central usa Tailwind 3, com o tema em `tailwind.config.ts`. Aqui é Tailwind 4,
onde o tema mora no CSS, em `@theme inline`. Os **nomes** dos tokens são
idênticos, então um componente copiado de lá funciona sem reescrita.

|          | Central                          | Aqui                       |
| -------- | -------------------------------- | -------------------------- |
| Tailwind | 3, config em TS                  | 4, tema no CSS             |
| Fontes   | `@import` do Google Fonts        | `next/font` (self-hosted)  |
| Temas    | Capital e Escola, claro e escuro | só Capital, claro e escuro |

Duas escolhas merecem explicação:

**Fontes por `next/font`.** As três famílias são as mesmas (Anek Latin nos
títulos, Roboto no corpo, Sora nos botões), mas os arquivos moram em
`src/fontes/` e são servidos pelo próprio domínio. Elimina a requisição a
terceiro no carregamento e o pulo de layout na troca da fonte de fallback pela
definitiva. Até 03/11/2026 elas vinham de `next/font/google`, baixadas a cada
build, e o deploy caía quando o Google respondia fora do esperado. A vitrine,
que não passa pelo Next, continua carregando do Google Fonts como a Central.

**Só o tema Capital.** A Central carrega também a identidade dourada da AUVP
Escola. Esta é uma ferramenta interna da Capital; o tema Escola entraria como
peso morto. Se um dia fizer sentido, o caminho é copiar o bloco `.escola` da
Central para o arquivo de tokens.

## Paleta

Verde AUVP `hsl(155 93% 11%)` como primária no tema claro. No escuro a base é
preto e branco, e o verde `hsl(145 20% 44%)` fica reservado para acentos
pontuais: é decisão da Central, não uma adaptação.

Os status semânticos (`success`, `warning`, `info`, `error`) já vêm com o par
fundo/texto resolvido nos dois temas. **Use-os em vez da paleta crua do
Tailwind**: `bg-amber-100` não passa pelas travas de contraste do DS e não
acompanha o tema escuro.

## O olho

O olho é o símbolo da marca AUVP. Vem de `public/olho-branco.svg` da Central e
mora em `src/components/marca/olho.tsx` como SVG inline com
`fill="currentColor"`, não como dois arquivos de imagem.

A razão é a regra do próprio Design System: versão clara sobre fundo escuro,
escura sobre fundo claro. Com `currentColor`, isso vira consequência da cor do
texto em volta, em vez de uma escolha manual a cada uso.

Aparece na navegação, na tela de login e nos estados vazios. O favicon usa o
mesmo traçado sobre o verde da marca, sem os ~15 KB de metadados C2PA do
arquivo original, que não servem a um ícone de aba.

## Movimento, sem piscada

Layout shift é o conteúdo escorregar. Piscada é outra coisa, e incomoda mais:
a tela apagar e reacender. As três causas, e o que fecha cada uma:

1. **Navegação de documento onde deveria haver transição.** `<form method="get">`
   e `<a href>` cru recarregam a aplicação inteira: fundo branco, tudo montado
   de novo. Filtro é mudança da mesma tela, não ida para outra. Use
   `FormDeFiltro` e `LinkDeFiltro`, em `src/components/filtro-sem-piscar.tsx`:
   eles continuam sendo `<form method="get">` e `<a href>` no HTML, e navegam
   dentro de `startTransition`, que mantém o conteúdo atual na tela enquanto o
   novo vem.
2. **Entrada partindo do transparente.** `entrada-de-conteudo` começa em
   `opacity: 0.65`, e não em zero: sair do nada e voltar apaga a tela por um
   instante. O que se vê agora é o conteúdo assentando. Só opacidade, sem
   deslize: um `transform` no wrapper prende todo `position: fixed` da página
   a ele, e o login, que ocupa a tela inteira, ficava espremido numa faixa.
3. **Reanimar a cada estado, e não a cada tela.** Na vitrine, `render()` roda a
   cada clique e a cada tecla; ela só recria o elemento com `animar-entrada`
   quando a tela muda de verdade. Repetir a animação a cada atualização fazia a
   página inteira reaparecer ao filtrar uma categoria ou digitar uma letra.

O esqueleto de `loading.tsx` **não** é piscada: ele entra na primeira carga de
uma rota, quando não existe conteúdo anterior para manter, ocupa a medida exata
do que vem depois, e some quando o servidor responde. Medido: a tela nunca fica
vazia numa troca de rota, o esqueleto preenche ~300 ms e cede o lugar.

## Movimento, sem layout shift

A navegação tem movimento, e mede-se isso: **CLS ≤ 0,0031** em todas as telas,
em build de produção, com CPU 4× mais lenta e rede a 400 kbps, trinta vezes
abaixo do limite de 0,1 que o Core Web Vitals considera bom.

Duas armadilhas da medição, aprendidas errando:

- **`addInitScript` é cumulativo.** Medir várias rotas na mesma página instala
  um observador a mais a cada volta, e a soma sai multiplicada pela posição na
  lista. Um contexto novo por rota resolve, e vale conferir o instrumento
  contra uma página que desloca de propósito.
- **Servidor rápido esconde o problema.** Se a consulta responde antes da
  primeira pintura, o esqueleto nunca aparece e a medição dá zero em tudo. Para
  medir de verdade é preciso atrasar a consulta de propósito, que é quando o
  esqueleto entra e o erro de dimensionamento aparece.

As regras que sustentam esse número:

1. **Anima-se só `opacity` e `transform`.** As duas rodam no compositor e não
   entram no cálculo de layout. Animar altura, margem ou largura reintroduz o
   salto na hora. A entrada de cada tela é `animar-entrada`, em
   `src/styles/auvp-tokens.css`.
2. **Todo `loading.tsx` tem as medidas do conteúdo real.** Um esqueleto mais
   baixo que a tabela que ele antecede produz exatamente o salto que deveria
   evitar. Ver `src/components/esqueletos.tsx`.
3. **Toda imagem tem moldura com proporção fixa e dimensões declaradas.** O
   espaço fica reservado antes de o primeiro byte chegar.
4. **`scrollbar-gutter: stable`.** Sem isso, ir de uma tela alta para uma curta
   faz a barra sumir e tudo deslizar na horizontal, um shift em toda
   navegação, bem na hora em que a pessoa vai clicar.

5. **As fontes usam `display: 'optional'`.** Com `swap`, a página pinta na
   fonte de fallback e troca quando a definitiva chega; a troca muda a largura
   do texto e empurra os itens do menu e as colunas da tabela. Com `optional`
   não há troca no meio do carregamento.

O `useLinkStatus` acende um ponto dentro do item de menu clicado enquanto a
rota carrega. O ponto ocupa largura fixa em todo estado, para que acender e
apagar não empurre os vizinhos.

O resíduo que sobra vem da altura das tabelas: a quantidade de linhas do
esqueleto é a única medida que não dá para acertar sempre, porque depende de
quantos registros a consulta devolve.

A curva de todas as transições é `ease-apple`, a mesma da Central.
`prefers-reduced-motion` desliga o movimento, como lá.

## Fotos de produto

O catálogo usa as fotos de estúdio dos brindes reais da AUVP, trazidas de
`src/assets/produtos-fisicos/` da Central para `public/produtos/`. São 900×1200
em WebP, e o card usa a proporção nativa 3:4, a foto preenche o quadro inteiro,
sem faixa de fundo sobrando.

A caneca AUPO11 tem os dois lados desenhados e gira em 3D no hover, como na
Central. A convenção é a mesma: nenhum campo novo no banco, basta existir
`<slug>-verso.webp` ao lado da foto da frente (`src/lib/fotos.ts`).

## Ilustrações de produto

Os produtos do seed têm foto. As ilustrações são o que aparece quando um
produto **não** tem: um catálogo com retângulos cinza escrito "sem foto" parece
um sistema quebrado, não um sistema em construção.

`src/lib/ilustracoes.ts` guarda um traço por categoria e alguns por produto,
todos no mesmo peso de linha, sobre um degradê da marca. A escolha é por
palavra no nome do produto primeiro, depois por categoria: sem isso, dois itens
de "Gourmet" dividiriam o mesmo desenho e a grade pareceria preenchida por
acaso.

Quando o produto tiver `fotoUrl`, a foto substitui a ilustração. Ela é o estado
de repouso do card, não um aviso de erro.

A vitrine recebe uma cópia gerada no build (`scripts/gerar-ilustracoes.ts`), em
vez de uma segunda lista mantida à mão.

## Menu superior

Mesmo desenho do `GlobalNav` da Central: barra clara com `backdrop-blur`, o
olho solto sobre o fundo (sem caixa, acompanhando o tema por `currentColor`),
itens em Anek Latin e o item ativo marcado por um sublinhado fino em vez de
fundo cheio.

**A barra não rola.** Duas decisões sustentam isso:

- os três CRUDs ficam sob um único item "Administração", o que mantém a barra
  em cinco itens, como a da Central. Sete itens não cabiam;
- não existe `overflow-x-auto` no menu. Além de a barra de rolagem horizontal
  ficar feia, `overflow-x: auto` **obriga o `overflow-y` a virar `auto`
  também**: o CSS não permite um eixo recortado e o outro visível. O
  resultado eram duas barras de rolagem dentro do cabeçalho e os balões de
  hover cortados, já que são filhos posicionados do item.

Cada item tem um balão com ícone e descrição no hover. O balão fica **sempre no
DOM**, entrando por opacidade e deslocamento, montá-lo e desmontá-lo a cada
passagem do mouse recalcularia layout.

No celular, o nome da seção atual vira o gatilho de um menu com as mesmas
descrições, como na Central.

## Componentes

`src/components/ui/` são portes do shadcn/ui da Central. As marcas registradas
do botão AUVP não devem ser suavizadas:

- Sora em caixa alta;
- canto de 5px, mais reto que o `--radius` do resto da interface;
- hover "vazado": o fundo sai e sobra a borda, na cor `*-emphasis`.

Os tokens `*-emphasis` existem porque a cor cheia da marca nem sempre é legível
como texto. É o que o hover vazado usa.

Selo (`Badge`) é cápsula (`rounded-full`), não retângulo.

Duas convenções de tipografia numérica, que o padrão do shadcn não traz:

- **número de destaque usa a fonte de corpo**, não a de título. Fonte de
  display em número grande lê como decoração, e o dado é o conteúdo;
- **`tabular-nums` só em coluna de tabela**, onde os dígitos precisam alinhar
  verticalmente. Num número solto e grande, a largura fixa abre espaços e o
  número parece frouxo.

## Cores literais, quando são necessárias

A barra de navegação tem fundo escuro nos dois temas, então o texto sobre ela é
claro sempre. Nesses casos as cores são literais (`text-white/70`) em vez de
tokens: `text-muted-foreground` é escuro no tema claro e sumiria sobre o verde.

É a exceção, não a regra. Fora de superfícies que fixam o próprio fundo, use os
tokens.

## Ao atualizar a identidade

1. Atualize a Central primeiro, ela é a fonte.
2. Traga os valores para `src/styles/auvp-tokens.css`.
3. `npm run demo:build`, para a vitrine acompanhar.

Nunca o contrário. Um token ajustado só aqui vira divergência silenciosa entre
esta ferramenta e o resto das ferramentas internas.
