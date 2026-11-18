import { cn } from '@/lib/utils'

/**
 * A Caixinha, mascote da plataforma: uma caixa de presente em kraft com a fita
 * verde AUVP, como os kits chegam ao cliente. É o mesmo desenho dos vídeos
 * (`video-hyperframes/lib/base.js`).
 *
 * As cores são da ilustração, e não tokens do Design System: o kraft e a fita
 * são o objeto, não a interface, e não mudam com o tema. A proporção é 24:25;
 * `className` controla a largura.
 *
 * `piscando` liga uma piscada de vez em quando (classe `caixinha-pisca`, em
 * globals.css), que respeita "reduzir movimento".
 *
 * `olhar` move as pupilas para onde a Caixinha olha, de -1 a 1 em cada eixo.
 * As pupilas têm grupo próprio, dentro do da piscada: piscar e olhar não
 * brigam pelo mesmo `transform`.
 */
export function Caixinha({
  className,
  piscando = false,
  olhar,
}: {
  className?: string
  piscando?: boolean
  olhar?: { x: number; y: number }
}) {
  const tinta = '#0B2905'
  // Até onde a pupila anda sem sair do branco do olho (raio 15 × 17, pupila 8,5).
  const dx = (olhar?.x ?? 0) * 5
  const dy = (olhar?.y ?? 0) * 6
  return (
    <svg
      viewBox="0 0 240 250"
      role="img"
      aria-label="Caixinha"
      className={cn('h-auto w-12', className)}
    >
      <ellipse cx="120" cy="238" rx="72" ry="8" fill="rgba(11,41,5,.14)" />
      <rect x="84" y="212" width="26" height="24" rx="11" fill="#5A3E22" />
      <rect x="130" y="212" width="26" height="24" rx="11" fill="#5A3E22" />
      <path
        d="M42 152 q-18 10 -20 30"
        stroke="#C99A64"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M198 152 q18 10 20 30"
        stroke="#C99A64"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="36" y="104" width="168" height="116" rx="18" fill="#DDB384" />
      <rect x="36" y="104" width="168" height="12" fill="#C99A64" />
      <rect x="110" y="104" width="20" height="116" fill="#1B8A4E" />
      <g className={piscando ? 'caixinha-pisca' : undefined}>
        <ellipse cx="84" cy="150" rx="15" ry="17" fill="#fff" />
        <ellipse cx="156" cy="150" rx="15" ry="17" fill="#fff" />
        <g className="caixinha-olhar" style={{ transform: `translate(${dx - 2}px, ${dy - 3}px)` }}>
          <circle cx="86" cy="153" r="8.5" fill={tinta} />
          <circle cx="158" cy="153" r="8.5" fill={tinta} />
          <circle cx="89.5" cy="148.5" r="3" fill="#fff" />
          <circle cx="161.5" cy="148.5" r="3" fill="#fff" />
        </g>
      </g>
      <g fill="#F07D97" opacity=".7">
        <ellipse cx="64" cy="178" rx="11" ry="6.5" />
        <ellipse cx="176" cy="178" rx="11" ry="6.5" />
      </g>
      <path
        d="M104 178 Q120 198 136 178 Z"
        fill={tinta}
        stroke={tinta}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="120" cy="189" rx="7" ry="4" fill="#F07D97" />
      <rect x="26" y="80" width="188" height="34" rx="11" fill="#C99A64" />
      <rect x="108" y="80" width="24" height="34" fill="#0B5D3A" />
      <ellipse cx="96" cy="66" rx="27" ry="14" transform="rotate(-22 96 66)" fill="#0E6B43" />
      <ellipse cx="144" cy="66" rx="27" ry="14" transform="rotate(22 144 66)" fill="#0E6B43" />
      <ellipse cx="96" cy="66" rx="12" ry="5.5" transform="rotate(-22 96 66)" fill="#08482C" />
      <ellipse cx="144" cy="66" rx="12" ry="5.5" transform="rotate(22 144 66)" fill="#08482C" />
      <circle cx="120" cy="73" r="10.5" fill="#08482C" />
    </svg>
  )
}
