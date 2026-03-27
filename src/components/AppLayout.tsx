'use client'

import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { FileSearch } from 'lucide-react'
import { useAppPreferences } from './AppPreferencesProvider'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useAppPreferences()

  return (
    <SidebarProvider
      style={{
        '--sidebar-background': 'var(--app-surface-2)',
        '--sidebar-foreground': 'var(--app-accent)',
        '--sidebar-primary': 'var(--app-highlight)',
        '--sidebar-primary-foreground': 'var(--app-on-accent)',
        '--sidebar-accent': 'var(--app-surface-soft)',
        '--sidebar-accent-foreground': 'var(--app-accent)',
        '--sidebar-border': 'var(--app-border)',
        '--sidebar-ring': 'var(--app-highlight)',
      } as React.CSSProperties}
    >
      <div className="flex h-screen w-full min-w-0 overflow-hidden bg-app">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0 w-full flex flex-col overflow-hidden bg-app">
          <header className="header-gradient flex h-16 shrink-0 items-center gap-2 border-b border-app px-4">
            <SidebarTrigger className="-ml-1 text-accent hover:opacity-80" />
            <div className="flex items-center gap-2 ml-2">
              <FileSearch className="h-5 w-5 text-highlight" />
              <span className="text-sm font-semibold text-white">{t('appName')}</span>
            </div>
          </header>
          <main className="flex-1 min-w-0 w-full overflow-auto p-6 bg-app">
            <div className="w-full max-w-none">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
