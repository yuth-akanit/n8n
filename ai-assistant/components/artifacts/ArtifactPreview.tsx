'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { timeAgo } from '@/lib/utils'

interface Props {
  id: string
  title: string
  artifactType: string
  format: string
  content: string
  projectId: string | null
  createdAt: string
  version: number
}

export function ArtifactPreview({
  id,
  title,
  artifactType,
  format,
  content,
  projectId,
  createdAt,
  version,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isImage = artifactType === 'image'

  return (
    <div className="card p-4">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
            <Badge label={artifactType} />
            {format && format !== artifactType && (
              <span className="text-xs text-gray-400 font-mono">{format}</span>
            )}
            {version > 1 && (
              <span className="text-xs text-gray-400">v{version}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{timeAgo(createdAt)}</span>
            {projectId && (
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View project
              </Link>
            )}
          </div>
        </div>

        {/* Expand / collapse button */}
        {!isImage && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 px-2 py-1 border border-gray-200 rounded hover:border-gray-400 transition-colors"
          >
            {expanded ? 'Collapse' : 'Preview'}
          </button>
        )}
      </div>

      {/* Image preview — always shown */}
      {isImage && content && (
        <div className="mt-3">
          <img
            src={content}
            alt={title}
            className="rounded-xl max-h-64 object-cover border border-gray-100"
            loading="lazy"
          />
        </div>
      )}

      {/* Text content preview */}
      {!isImage && expanded && (
        <div className="mt-3 bg-gray-50 rounded-xl border border-gray-100 p-3 overflow-auto max-h-96">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
            {content}
          </pre>
        </div>
      )}

      {/* Collapsed text teaser */}
      {!isImage && !expanded && content && (
        <p className="text-xs text-gray-400 mt-2 truncate font-mono">
          {content.slice(0, 120)}
        </p>
      )}
    </div>
  )
}
