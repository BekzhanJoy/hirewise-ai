
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGet, apiSend } from '@/lib/local-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HardDrive, Palette, Globe, User, Save, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { COLOR_SCHEME_OPTIONS, LANGUAGE_OPTIONS, AppColorScheme, AppLanguage } from '@/lib/translations'
import { useAppPreferences } from '@/components/AppPreferencesProvider'

interface UserSettings {
  user_id: string
  auto_save_resumes: boolean
  color_scheme: AppColorScheme
  language: AppLanguage
  max_storage_mb: number
}

interface Profile {
  id: string
  email: string
  full_name: string
}

interface SessionUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
  }
}

const STORAGE_OPTIONS = [
  { value: 100, label: '100 MB' },
  { value: 500, label: '500 MB' },
  { value: 1000, label: '1 GB' },
  { value: 5000, label: '5 GB' },
]

export default function SettingsPage() {
  const { user, updateSessionUser } = useAuth()
  const { colorScheme, language, setColorScheme, setLanguage, t } = useAppPreferences()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<UserSettings>({
    user_id: '',
    auto_save_resumes: true,
    color_scheme: 'emerald',
    language: 'en',
    max_storage_mb: 500,
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return
      try {
        const payload = await apiGet<{ profile: Profile | null; settings: UserSettings | null }>(`/api/settings?userId=${encodeURIComponent(user.id)}`)
        if (payload.profile) setProfile(payload.profile)
        if (payload.settings) {
          setSettings(payload.settings)
          setColorScheme(payload.settings.color_scheme)
          setLanguage(payload.settings.language)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings')
      }
      setIsLoading(false)
    }
    run()
  }, [user?.id, setColorScheme, setLanguage])

  useEffect(() => {
    setSettings((prev) => ({ ...prev, color_scheme: colorScheme, language }))
  }, [colorScheme, language])

  const saveSettings = async () => {
    if (!user?.id || !profile) return

    const wantsPasswordChange = Boolean(newPassword || confirmPassword)
    const wantsEmailChange = profile.email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()

    if (!profile.full_name.trim()) {
      toast.error('Full name is required')
      return
    }

    if (!profile.email.trim()) {
      toast.error('Email is required')
      return
    }

    if (wantsPasswordChange) {
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters')
        return
      }
      if (newPassword !== confirmPassword) {
        toast.error('New password and confirmation do not match')
        return
      }
    }

    if ((wantsEmailChange || wantsPasswordChange) && !currentPassword) {
      toast.error('Enter current password to change email or password')
      return
    }

    setIsSaving(true)
    try {
      const payload = await apiSend<{ profile: Profile | null; settings: UserSettings | null; user: SessionUser | null }>('/api/settings', 'PUT', {
        userId: user.id,
        profile,
        account: {
          email: profile.email,
          full_name: profile.full_name,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
        },
        settings: { ...settings, color_scheme: colorScheme, language },
      })

      if (payload.profile) setProfile(payload.profile)
      if (payload.settings) setSettings(payload.settings)
      if (payload.user) updateSessionUser(payload.user)

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('settingsSaved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return <div className="text-muted-app">{t('loadingSettings')}</div>
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold text-accent">{t('settingsTitle')}</h1>
        <p className="text-sm mt-1 text-muted-app">{t('settingsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <Card className="card-app border-app 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <HardDrive className="w-5 h-5" /> {t('storage')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base text-accent">{t('autoSaveResumes')}</Label>
                <p className="text-sm text-muted-app">{t('keepUploadedFiles')}</p>
              </div>
              <Switch checked={settings.auto_save_resumes} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, auto_save_resumes: checked }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-accent">{t('maximumStorage')}</Label>
              <Select value={settings.max_storage_mb.toString()} onValueChange={(value) => setSettings((prev) => ({ ...prev, max_storage_mb: parseInt(value, 10) }))}>
                <SelectTrigger className="bg-surface-2 border-app text-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-app text-accent">
                  {STORAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="card-app border-app 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Palette className="w-5 h-5" /> {t('appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-2 gap-4">
              {COLOR_SCHEME_OPTIONS.map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => setColorScheme(scheme.id)}
                  className="p-4 rounded-lg border-2 transition-all"
                  style={{ backgroundColor: scheme.bg, borderColor: colorScheme === scheme.id ? scheme.color : 'var(--app-border)' }}
                >
                  <div className="w-8 h-8 rounded-full mx-auto mb-2" style={{ backgroundColor: scheme.color }} />
                  <p className="text-sm font-medium text-center" style={{ color: scheme.color }}>{scheme.name}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-app border-app 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Globe className="w-5 h-5" /> {t('language')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={(value) => setLanguage(value as AppLanguage)}>
              <SelectTrigger className="bg-surface-2 border-app text-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-app text-accent">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="card-app border-app 2xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <User className="w-5 h-5" /> {t('account')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-accent">{t('email')}</Label>
              <Input
                value={profile?.email || ''}
                onChange={(e) => setProfile((prev) => prev ? { ...prev, email: e.target.value } : { id: user?.id || '', email: e.target.value, full_name: user?.user_metadata?.full_name || '' })}
                className="bg-surface-2 border-app text-accent"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-accent">{t('fullName')}</Label>
              <Input
                value={profile?.full_name || ''}
                onChange={(e) => setProfile((prev) => prev ? { ...prev, full_name: e.target.value } : { id: user?.id || '', email: user?.email || '', full_name: e.target.value })}
                className="bg-surface-2 border-app text-accent"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="card-app border-app 2xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <LockKeyhole className="w-5 h-5" /> {t('password')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-accent">{t('currentPassword')}</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-surface-2 border-app text-accent" />
            </div>
            <div className="space-y-2">
              <Label className="text-accent">{t('newPassword')}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-surface-2 border-app text-accent" />
            </div>
            <div className="space-y-2">
              <Label className="text-accent">{t('confirmNewPassword')}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-surface-2 border-app text-accent" />
            </div>
            <p className="text-xs text-muted-app">{t('passwordNote')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={isSaving} className="gap-2 bg-accent-app text-on-accent hover:opacity-90">
          <Save className="w-4 h-4" />
          {isSaving ? t('saving') : t('saveChanges')}
        </Button>
      </div>
    </div>
  )
}
