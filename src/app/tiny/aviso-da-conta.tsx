import { AlertTriangle } from 'lucide-react'
import { NOME_DA_CONTA, VARIAVEL_DO_TOKEN, type ContaTiny } from '@/lib/tiny/contas'

/**
 * O aviso das telas que leem uma conta do Tiny: ela está sem token, ou o Tiny
 * não respondeu. Diz qual conta e qual variável falta, porque são três.
 */
export function AvisoDaConta({ conta, erro }: { conta: ContaTiny; erro?: string | null }) {
  return (
    <div
      role="alert"
      className="border-warning/40 bg-warning/10 mb-6 flex gap-3 rounded-lg border p-4 text-sm"
    >
      <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>
        {erro ? (
          <>
            <span className="font-semibold">O Tiny da {NOME_DA_CONTA[conta]} não respondeu.</span>{' '}
            {erro}
          </>
        ) : (
          <>
            <span className="font-semibold">
              O Tiny da {NOME_DA_CONTA[conta]} ainda não está ligado.
            </span>{' '}
            Falta o token em <code>{VARIAVEL_DO_TOKEN[conta]}</code>, na Vercel.
          </>
        )}
      </p>
    </div>
  )
}
