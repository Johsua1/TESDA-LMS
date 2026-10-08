import { cn, initials } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

// -------------------------------- Button ------------------------------------
const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  outline: 'border border-brand-500 text-brand-700 hover:bg-brand-50',
  tesda: 'bg-tesda-blue text-white hover:bg-brand-800 shadow-sm',
}

const buttonSizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
      {children}
      {IconRight && !loading && <IconRight className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </button>
  )
}

export function IconButton({ label, variant = 'ghost', className, icon: Icon, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

// --------------------------------- Badge ------------------------------------
const badgeTones = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export function Badge({ tone = 'neutral', className, children, dot = false }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

// ---------------------------------- Card ------------------------------------
export function Card({ className, children, hover = false, ...props }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

// ------------------------------- ProgressBar --------------------------------
export function ProgressBar({ value = 0, className, tone, showLabel = false, size = 'md' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const auto = v >= 75 ? 'bg-emerald-500' : v >= 40 ? 'bg-brand-500' : 'bg-amber-500'
  const color = tone || auto
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('w-full overflow-hidden rounded-full bg-slate-100', height)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${v}%` }}
          role="progressbar"
          aria-valuenow={v}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && <span className="shrink-0 text-xs font-semibold text-slate-600">{v}%</span>}
    </div>
  )
}

// --------------------------------- Avatar -----------------------------------
const avatarSizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

export function Avatar({ name, color = 'from-brand-500 to-brand-700', size = 'md', className, src }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white',
        color,
        avatarSizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt={name} className="h-full w-full rounded-full object-cover" /> : initials(name)}
    </span>
  )
}

// -------------------------------- StatCard ----------------------------------
const statTones = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  purple: 'bg-violet-50 text-violet-600',
  info: 'bg-sky-50 text-sky-600',
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, trend, className }) {
  return (
    <Card className={cn('p-5', className)} hover>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', statTones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {trend && <div className="mt-3">{trend}</div>}
    </Card>
  )
}

// ------------------------------- EmptyState ---------------------------------
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ------------------------------- PageHeader ---------------------------------
export function PageHeader({ title, description, action, breadcrumb, className }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        {breadcrumb && <div className="mb-1 text-xs text-slate-400">{breadcrumb}</div>}
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

// -------------------------------- Divider -----------------------------------
export function Divider({ className }) {
  return <hr className={cn('border-slate-100', className)} />
}

// -------------------------------- Skeleton ----------------------------------
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
}

// ------------------------------ SectionTitle --------------------------------
export function SectionTitle({ children, action, className }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between', className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  )
}
