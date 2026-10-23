import { AbasDoTiny } from './abas'

export default function TinyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AbasDoTiny />
      {children}
    </>
  )
}
