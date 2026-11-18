import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Botão do Design System AUVP.
 *
 * Portado de `src/components/ui/button.tsx` da Central. As três marcas
 * registradas do botão AUVP estão aqui e não devem ser suavizadas: Sora em
 * caixa alta, canto de 5px (mais reto que o `--radius` do resto da interface)
 * e o hover "vazado", em que o fundo sai e sobra a borda.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[5px] font-sora font-semibold uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Os estados vazados usam os tokens *-emphasis: a cor da marca legível
        // como texto sobre o fundo do tema ativo. A cor cheia nem sempre é.
        default:
          'border border-primary bg-primary text-primary-foreground hover:border-primary-emphasis hover:bg-transparent hover:text-primary-emphasis',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        // No escuro, cheio de branco: é o "selecionado" das alternâncias, e
        // vazado ficava igual ao `outline` ao lado.
        secondary:
          'border border-secondary bg-secondary text-secondary-foreground hover:border-secondary-emphasis hover:bg-transparent hover:text-secondary-emphasis dark:border-foreground dark:bg-foreground dark:text-background dark:hover:bg-transparent dark:hover:text-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary-emphasis underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-8 py-[18px] text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
