function cn(...values) {
  return values.filter(Boolean).join(' ')
}

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl transition hover:border-accent/60',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('p-5 pb-3 space-y-1', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-300/80', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('px-5 pb-5 pt-2 flex items-center justify-between', className)} {...props} />
}
