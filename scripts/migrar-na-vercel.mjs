// Aplica as migrations no build da Vercel, só no deploy de produção, e carrega
// o catálogo real quando o banco ainda não tem nenhum produto.
//
// Na imagem Docker quem faz isso é o docker-entrypoint.sh, na subida do
// container. Na Vercel não há container nem etapa de subida: o build é o único
// momento em que dá para rodar algo antes de o tráfego chegar.
//
// Só no ambiente "production" da Vercel (o deploy do main). Os previews
// compartilhariam o mesmo banco, e uma migration que ainda está em revisão não
// pode alterar os dados de quem usa a ferramenta. Ver docs/12-producao-vercel.md.
import { spawnSync } from 'node:child_process'

if (process.env.VERCEL_ENV !== 'production') {
  console.log(
    `Migrations não rodam em "${process.env.VERCEL_ENV ?? 'fora da Vercel'}": só o deploy de produção migra o banco.`,
  )
  process.exit(0)
}

// Migration precisa de conexão direta: atrás do pooler, que é o endereço que a
// aplicação usa, o Prisma não segura a trava que impede duas migrations ao
// mesmo tempo. O Postgres da Vercel (Neon) entrega os dois endereços.
const direta =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL

// A aplicação usa DATABASE_URL em runtime. Migrar com sucesso e publicar sem
// ela daria um site que falha em toda página, então as duas são exigidas aqui.
if (!direta || !process.env.DATABASE_URL?.trim()) {
  // Só nomes e se estão vazias: valor de variável de banco é segredo e não vai
  // para log de build.
  const encontradas = Object.keys(process.env)
    .filter((nome) => /DATABASE|POSTGRES/.test(nome))
    .sort()
    .map((nome) => `${nome} (${process.env[nome]?.trim() ? 'preenchida' : 'vazia'})`)

  console.error(
    [
      'O banco não está configurado no ambiente Production da Vercel.',
      `Variáveis de banco encontradas: ${encontradas.length ? encontradas.join(', ') : 'nenhuma'}.`,
      'Esperado: DATABASE_URL e DATABASE_URL_UNPOOLED preenchidas, criadas ao conectar o',
      'Postgres ao ambiente Production, sem prefixo personalizado. Se uma DATABASE_URL vazia',
      'já existia no projeto, apague-a e conecte o banco de novo.',
      'Ver docs/12-producao-vercel.md, passo 1.',
    ].join('\n'),
  )
  process.exit(1)
}

function rodar(comando, args) {
  const resultado = spawnSync(comando, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: direta },
  })
  if (resultado.status !== 0) process.exit(resultado.status ?? 1)
}

rodar('npx', ['prisma', 'migrate', 'deploy'])

// Na demonstração, cada deploy recarrega os dados fictícios: as demandas da
// Logística acompanham a data do dia, e o que alguém apagou ou mudou testando
// volta. O seed é idempotente. No uso real ele nunca roda aqui: os dados são os
// que a área cadastrar, e só o catálogo entra sozinho, uma vez.
if (process.env.MODO_DEMONSTRACAO === 'true') {
  console.log('Modo demonstração: recarregando os dados fictícios.')
  rodar('npm', ['run', 'db:seed'])
} else {
  rodar('npm', ['run', 'db:catalogo', '--', '--so-se-vazio'])
}
