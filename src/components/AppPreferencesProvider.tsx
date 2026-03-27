'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGet } from '@/lib/local-api'
import { AppColorScheme, AppLanguage, translate, TranslationKey } from '@/lib/translations'

type AppPreferencesContextValue = {
  colorScheme: AppColorScheme
  language: AppLanguage
  setColorScheme: (value: AppColorScheme) => void
  setLanguage: (value: AppLanguage) => void
  t: (key: TranslationKey) => string
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null)

const COLOR_KEY = 'hirewise-color-scheme'
const LANG_KEY = 'hirewise-language'

function applyDocumentPreferences(colorScheme: AppColorScheme, language: AppLanguage) {
  document.documentElement.dataset.colorScheme = colorScheme
  document.documentElement.lang = language
}

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [colorScheme, setColorSchemeState] = useState<AppColorScheme>('emerald')
  const [language, setLanguageState] = useState<AppLanguage>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedColor = window.localStorage.getItem(COLOR_KEY) as AppColorScheme | null
    const storedLanguage = window.localStorage.getItem(LANG_KEY) as AppLanguage | null
    if (storedColor) setColorSchemeState(storedColor)
    if (storedLanguage) setLanguageState(storedLanguage)
  }, [])

  useEffect(() => {
    applyDocumentPreferences(colorScheme, language)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COLOR_KEY, colorScheme)
      window.localStorage.setItem(LANG_KEY, language)
    }
  }, [colorScheme, language])

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return
      try {
        const payload = await apiGet<{ settings?: { color_scheme?: AppColorScheme; language?: AppLanguage } | null }>(`/api/settings?userId=${encodeURIComponent(user.id)}`)
        if (payload.settings?.color_scheme) setColorSchemeState(payload.settings.color_scheme)
        if (payload.settings?.language) setLanguageState(payload.settings.language)
      } catch {
        // keep local fallback
      }
    }
    run()
  }, [user?.id])

  const value = useMemo<AppPreferencesContextValue>(() => ({
    colorScheme,
    language,
    setColorScheme: setColorSchemeState,
    setLanguage: setLanguageState,
    t: (key) => translate(language, key),
  }), [colorScheme, language])

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext)
  if (!context) throw new Error('useAppPreferences must be used within AppPreferencesProvider')
  return context
}
