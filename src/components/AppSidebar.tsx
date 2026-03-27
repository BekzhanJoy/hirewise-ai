'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Upload,
  Library,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  FileSearch,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar'
import { useAppPreferences } from './AppPreferencesProvider'

export function AppSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { t } = useAppPreferences()

  const navItems = [
    { href: '/dashboard', label: t('navHome'), icon: Home },
    { href: '/dashboard/upload', label: t('navUpload'), icon: Upload },
    { href: '/dashboard/library', label: t('navLibrary'), icon: Library },
    { href: '/dashboard/about', label: t('navAbout'), icon: Users },
    { href: '/dashboard/settings', label: t('navSettings'), icon: Settings },
    { href: '/dashboard/help', label: t('navHelp'), icon: HelpCircle },
  ]

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U'
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <Sidebar className="border-r border-app bg-surface-2" collapsible="icon">
      <SidebarHeader className="border-b border-app">
        <div className="flex items-center gap-2 px-4 py-3">
          <FileSearch className="h-6 w-6 text-highlight" />
          <span className="text-lg font-semibold text-white">{t('appName')}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-app text-xs uppercase tracking-wider">
            {t('navGroup')}
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={`transition-all duration-200 ${
                      isActive
                        ? 'bg-surface-soft text-white hover:opacity-90'
                        : 'text-accent bg-transparent'
                    }`}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-app">
        <div className="p-4">
          {user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-2">
                <Avatar className="h-9 w-9 border border-app">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-surface-soft text-white text-xs">
                    {getInitials(user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-white truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-xs text-muted-app truncate">{user.email}</span>
                </div>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-accent bg-transparent rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm bg-accent-app text-on-accent rounded-md transition-colors"
            >
              {t('signIn')}
            </Link>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
