'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CrmPageHeaderProps {
  title: string
  count?: number
  subtitle?: string
  children?: ReactNode
}

export default function CrmPageHeader({ title, count, subtitle, children }: CrmPageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-crm-manrope text-[28px] font-bold text-crm-text-primary tracking-tight leading-tight">
            {title}
          </h1>
          {count !== undefined && (
            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-crm-bg-tertiary text-xs font-semibold text-crm-text-secondary border border-crm-border">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[13px] text-crm-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </motion.div>
  )
}
