import type { Metadata } from 'next'
import './crm-theme.css'
import CrmSidebar from '@/components/crm/CrmSidebar'
import CrmTopBar from '@/components/crm/CrmTopBar'

export const metadata: Metadata = {
  title: 'InvoltCRM',
  description: 'Управление клиентами и сделками',
}

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="crm-shell flex min-h-[100dvh] bg-crm-bg-primary">
      <CrmSidebar />
      <div className="flex-1 flex flex-col ml-[240px] relative z-10">
        <CrmTopBar />
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
