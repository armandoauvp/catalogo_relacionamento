import { Suspense } from 'react'
import { contasLigadas } from '@/lib/env'
import { AbasDoTiny } from './abas'

export default function TinyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* As abas leem a conta da URL; sem o Suspense, a página inteira esperaria por elas. */}
      <Suspense fallback={<div className="mb-8 h-[41px] border-b" />}>
        <AbasDoTiny ligadas={contasLigadas()} />
      </Suspense>
      {children}
    </>
  )
}
