# A Caixinha: perguntas frequentes da plataforma

A Caixinha é o mascote da plataforma e, dentro dela, o lugar onde a pessoa tira
dúvida sem sair da tela: um botão fixo no canto inferior direito abre um painel
com busca, as perguntas mais comuns do perfil e, em cada resposta, o link para a
tela que resolve.

**Não há IA.** É uma FAQ pesquisável, por decisão da área: sem custo por
pergunta, sem chave de API, sem texto inventado. Nada do que a pessoa digita é
guardado; a busca roda no navegador.

## Onde mora cada coisa

| O quê                         | Arquivo                                  |
| ----------------------------- | ---------------------------------------- |
| Perguntas, respostas e links  | `src/lib/assistente/faq.ts`              |
| Busca (acento, sinônimos)     | `src/lib/assistente/busca.ts`            |
| O desenho do mascote          | `src/components/marca/caixinha.tsx`      |
| O botão e o painel            | `src/components/assistente.tsx`          |
| A piscada (reduzir movimento) | `src/app/globals.css`, `.caixinha-pisca` |

## Cada um vê o que é seu

Cada pergunta declara para quem vale, pela mesma matriz de `permissions.ts`:

- `exige`: uma ou mais permissões; vale para quem tem pelo menos uma;
- `excetoQuem`: some para quem tem esta permissão. Ex.: "como peço à
  Logística" não aparece para quem opera a Logística, e "preciso cancelar"
  não aparece para quem já pode cancelar;
- `paraPerfis`: quando a dúvida só existe para um perfil, como "por que só vejo
  a Logística?" para o Colaborador.

O filtro (`faqDoPerfil`) roda no servidor, no `layout.tsx`: o navegador só
recebe as perguntas do perfil. Não há segredo nas respostas, mas assim ninguém
lê como fazer o que não pode fazer.

## A busca

`buscarNaFaq` ignora acento, maiúscula e pontuação, descarta palavras vazias
("como", "meu", "onde"...) e casa pelo começo da palavra ("rastre" acha
"rastreio"). Alguns grupos de sinônimos cobrem o jeito como a área fala:
presente/solicitação/pedido, entregue/recebeu/chegou, limite/saldo/gasto e
outros, em `SINONIMOS`.

A ordem: primeiro quem casa com todas as palavras digitadas; depois, pelo peso
de onde casou (pergunta vale 3, palavras-chave 2, resposta 1); depois, a ordem da
lista. Sem nada digitado, aparecem os `destaque` do perfil.

## Ao mudar a plataforma

A FAQ descreve telas e regras, então envelhece junto com elas. Ao mudar uma tela
de lugar, renomear um status ou mudar uma regra de fluxo, procure o assunto em
`faq.ts` e ajuste a resposta e o `href`. Os testes (`faq.test.ts`) garantem que
ninguém vê pergunta de uma permissão que não tem e que os links são caminhos do
app, mas não leem o texto.

Para acrescentar uma pergunta: um item novo em `FAQ`, com `exige` (ou
`paraPerfis`), `termos` com as palavras que alguém usaria e que não estão na
pergunta, e `destaque: true` se ela deve aparecer antes de a pessoa digitar.
