import type { Metadata } from 'next'
import { Anek_Latin, Roboto, Sora } from 'next/font/google'
import { usuarioAtual } from '@/lib/auth-guards'
import { modoDemonstracao, perfilLivre } from '@/lib/env'
import { Nav } from '@/components/nav'
import { Transicao } from '@/components/transicao'
import './globals.css'

/*
 * Tipografia do Design System AUVP: Anek Latin nos títulos, Roboto no corpo,
 * Sora nos botões.
 *
 * Servidas pelo `next/font` em vez do @import do Google Fonts que a Central
 * usa: as fontes são baixadas no build e servidas pelo próprio domínio, sem
 * requisição a terceiro no carregamento.
 *
 * `display: 'optional'` é o que zera o layout shift de tipografia. Com `swap`,
 * a página pinta na fonte de fallback e troca quando a definitiva chega, e a
 * troca muda a largura do texto, empurrando os itens do menu e as colunas da
 * tabela. Com `optional`, o navegador usa a definitiva se ela chegar na janela
 * inicial e, se não chegar, mantém o fallback por aquele carregamento, sem
 * troca no meio. Como as fontes são servidas do próprio domínio e ficam em
 * cache, na prática elas chegam a tempo a partir do primeiro acesso.
 */
const anek = Anek_Latin({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-anek-src',
  display: 'optional',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto-src',
  display: 'optional',
})

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora-src',
  display: 'optional',
})

export const metadata: Metadata = {
  title: 'Catálogo de Presentes',
  description: 'Catálogo e solicitação de presentes da área de Relacionamento da AUVP',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A navegação depende do perfil, então é montada no servidor a cada request.
  const usuario = await usuarioAtual()

  return (
    <html lang="pt-BR" className={`${anek.variable} ${roboto.variable} ${sora.variable}`}>
      {/* Mesma casca da Central: fundo liso, header sticky, conteúdo em 7xl e
          rodapé. Os cards se separam pela borda, não por contraste de fundo. */}
      <body className="bg-background flex min-h-screen flex-col antialiased">
        {/* Ninguém pode confundir a demonstração com a ferramenta de verdade:
            quem testa precisa saber que o que aprova e exclui é fictício. */}
        {modoDemonstracao && usuario ? (
          <div className="bg-warning/15 border-warning/30 border-b px-4 py-2 text-center text-sm">
            <strong>Demonstração.</strong> Dados fictícios: pode aprovar, editar e exportar à
            vontade.
          </div>
        ) : null}
        {/* A fase de testes precisa ser lembrada para ser desligada. */}
        {perfilLivre && usuario ? (
          <div className="bg-warning/15 border-warning/30 border-b px-4 py-2 text-center text-sm">
            <strong>Fase de testes.</strong> Qualquer conta da AUVP escolhe o perfil no menu da
            conta, e os dados são os de verdade.
          </div>
        ) : null}
        {usuario ? (
          <Nav perfil={usuario.perfil} nome={usuario.nome} perfilLivre={perfilLivre} />
        ) : null}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-8">
          <Transicao>{children}</Transicao>
        </main>

        {usuario ? (
          <footer className="border-t py-6">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
              <p className="text-muted-foreground font-roboto text-center text-xs">
                Catálogo de Presentes · Relacionamento AUVP
              </p>
            </div>
          </footer>
        ) : null}
      </body>
    </html>
  )
}
