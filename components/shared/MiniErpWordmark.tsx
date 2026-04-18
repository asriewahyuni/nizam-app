import { cn } from '@/lib/utils'

interface MiniErpWordmarkProps {
  className?: string
  erpClassName?: string
  prefix?: string
  suffix?: string
}

export function MiniErpWordmark({
  className,
  erpClassName,
  prefix = 'Mini',
  suffix = '',
}: MiniErpWordmarkProps) {
  return (
    <span className={className}>
      {prefix}
      <span className={cn('text-amber-400', erpClassName)}>ERP</span>
      {suffix}
    </span>
  )
}
