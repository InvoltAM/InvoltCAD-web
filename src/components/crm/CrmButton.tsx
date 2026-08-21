'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface CrmButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  icon?: ReactNode
  disabled?: boolean
}

export default function CrmButton({
  children,
  variant = 'primary',
  onClick,
  type = 'button',
  className = '',
  icon,
  disabled,
}: CrmButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-colors'
  const variants = {
    primary: 'bg-crm-accent text-white hover:bg-crm-accent-hover shadow-[0_4px_12px_rgba(79,110,247,0.25)]',
    secondary: 'bg-crm-bg-tertiary border border-crm-border text-crm-text-primary hover:border-crm-border-hover',
    danger: 'bg-crm-status-unpaid text-white hover:bg-[#DC2626]',
    ghost: 'text-crm-text-secondary hover:bg-crm-bg-tertiary hover:text-crm-text-primary',
  }

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      {children}
    </motion.button>
  )
}
