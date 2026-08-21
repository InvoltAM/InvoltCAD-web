'use client'

import { Search, X } from 'lucide-react'

interface CrmSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
}

export default function CrmSearch({ value, onChange, placeholder = 'Поиск...', hint }: CrmSearchProps) {
  return (
    <div className="flex items-center gap-3 bg-crm-bg-secondary border border-crm-border rounded-lg px-4 py-3">
      <Search size={16} className="text-crm-text-muted flex-shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-crm-text-muted hover:text-crm-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}
      {hint && (
        <span className="text-xs text-crm-text-muted ml-auto hidden sm:block">{hint}</span>
      )}
    </div>
  )
}
