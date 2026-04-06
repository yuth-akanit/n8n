import { getStatusColor } from '@/lib/utils'

interface BadgeProps {
  label: string
  status?: string
  className?: string
}

export function Badge({ label, status, className = '' }: BadgeProps) {
  const colorClass = status ? getStatusColor(status) : 'bg-gray-100 text-gray-700'
  return (
    <span className={`badge ${colorClass} ${className}`}>
      {label}
    </span>
  )
}
