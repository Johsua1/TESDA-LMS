import { Badge } from './primitives'
import { classNamesForStatus } from '../../lib/utils'

export function StatusBadge({ status, className, dot = true }) {
  if (status == null || status === '') return <span className="text-slate-400">—</span>
  const tone = classNamesForStatus(status)
  return (
    <Badge tone={tone} dot={dot} className={className}>
      {status}
    </Badge>
  )
}

export default StatusBadge
