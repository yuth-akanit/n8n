'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface Props {
  placeholder?: string
  paramKey?: string // URL param name, default 'q'
}

/**
 * SearchInput — client component that updates a URL search param.
 * The parent Server Component reads `searchParams.q` and filters data.
 * Debounces by using form submit (Enter / click) instead of onChange.
 */
export function SearchInput({ placeholder = 'Search…', paramKey = 'q' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentValue = searchParams.get(paramKey) ?? ''

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = (fd.get('q') as string).trim()
    const params = new URLSearchParams(searchParams.toString())
    if (q) {
      params.set(paramKey, q)
    } else {
      params.delete(paramKey)
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function handleClear() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(paramKey)
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          name="q"
          type="search"
          defaultValue={currentValue}
          placeholder={placeholder}
          className="input pl-9 pr-8 w-64"
          disabled={isPending}
        />
        {currentValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>
      <button type="submit" className="btn-secondary" disabled={isPending}>
        {isPending ? '…' : 'Search'}
      </button>
    </form>
  )
}
