import React from 'react'

interface SymbolProps {
  className?: string
}

export function SocketIP21Symbol({ className }: SymbolProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Корпус / монтажная коробка */}
      <rect x="8" y="8" width="48" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
      {/* Лицевая панель — круг */}
      <circle cx="32" cy="30" r="14" stroke="currentColor" strokeWidth="2" />
      {/* Контакты: PE — сверху, L — слева снизу, N — справа снизу */}
      <circle cx="32" cy="22" r="2" fill="currentColor" />
      <circle cx="24" cy="36" r="2" fill="currentColor" />
      <circle cx="40" cy="36" r="2" fill="currentColor" />
      {/* Заземление */}
      <line x1="32" y1="38" x2="32" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="50" x2="40" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="54" x2="36" y2="54" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function SocketIP44Symbol({ className }: SymbolProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Корпус / монтажная коробка */}
      <rect x="8" y="8" width="48" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
      {/* Лицевая панель — круг */}
      <circle cx="32" cy="30" r="14" stroke="currentColor" strokeWidth="2" />
      {/* Контакты: PE — сверху, L — слева снизу, N — справа снизу */}
      <circle cx="32" cy="22" r="2" fill="currentColor" />
      <circle cx="24" cy="36" r="2" fill="currentColor" />
      <circle cx="40" cy="36" r="2" fill="currentColor" />
      {/* Заземление */}
      <line x1="32" y1="38" x2="32" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="50" x2="40" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="54" x2="36" y2="54" stroke="currentColor" strokeWidth="2" />
      {/* Степень защиты IP44 */}
      <text x="34" y="56" fill="currentColor" fontSize="8" fontFamily="Arial, sans-serif" textAnchor="middle">
        IP44
      </text>
    </svg>
  )
}
