'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CrmCardProps {
  children: ReactNode
  className?: string
  accent?: string
  hover?: boolean
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
}

export default function CrmCard({
  children,
  className = '',
  accent,
  hover = true,
  onDragOver,
  onDrop,
}: CrmCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`
        bg-crm-bg-secondary border border-crm-border rounded-lg
        ${accent ? `border-l-[4px] ${accent}` : ''}
        ${hover ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-crm-border-hover hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}
