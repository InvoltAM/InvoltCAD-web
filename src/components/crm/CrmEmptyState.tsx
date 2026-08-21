'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface CrmEmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}

export default function CrmEmptyState({ title, description, icon, action }: CrmEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      {icon && <div className="text-crm-text-muted mb-6">{icon}</div>}
      <h3 className="font-crm-manrope text-base font-semibold text-crm-text-secondary mb-2">
        {title}
      </h3>
      <p className="text-sm text-crm-text-muted mb-6">{description}</p>
      {action}
    </motion.div>
  )
}
