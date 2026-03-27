'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileSearch, TrendingUp, Award, BarChart3, Upload, Library, Settings, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { apiGet } from '@/lib/local-api'
import { toast } from 'sonner'
import { useAppPreferences } from '@/components/AppPreferencesProvider'

interface Resume {
  id: string
  file_name: string
  created_at: string
}

interface ScanResult {
  id: string
  resume_id: string
  match_score: number
  is_best_match: boolean
  created_at: string
  resumes: Resume | null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t, language } = useAppPreferences()
  const [stats, setStats] = useState({
    resumesScanned: 0,
    keywordsMatched: 0,
    bestMatches: 0,
  })
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      try {
        const payload = await apiGet<{ stats: typeof stats; recentScans: ScanResult[] }>(`/api/dashboard?userId=${encodeURIComponent(user.id)}`)
        setStats(payload.stats)
        setRecentScans(payload.recentScans)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [user?.id])

  const quickActions = [
    { title: t('uploadResume'), description: t('uploadResumeDesc'), icon: Upload, href: '/dashboard/upload' },
    { title: t('navLibrary'), description: t('resumeLibraryDesc'), icon: Library, href: '/dashboard/library' },
    { title: t('navSettings'), description: t('settingsDesc'), icon: Settings, href: '/dashboard/settings' },
  ]

  return (
    <div className="space-y-8 w-full">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white">{t('dashboardTitle')}</h1>
        <p className="text-lg text-muted-app max-w-3xl mx-auto">{t('dashboardSubtitle')}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-app border-app">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-app text-sm font-medium">{t('resumes')}</CardTitle>
            <FileSearch className="h-5 w-5 text-highlight" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.resumesScanned}</div>
            <p className="text-xs text-muted-app mt-1">{t('storedLocally')}</p>
          </CardContent>
        </Card>

        <Card className="card-app border-app">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-app text-sm font-medium">{t('scans')}</CardTitle>
            <TrendingUp className="h-5 w-5 text-highlight" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.keywordsMatched}</div>
            <p className="text-xs text-muted-app mt-1">{t('savedScanResults')}</p>
          </CardContent>
        </Card>

        <Card className="card-app border-app">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-app text-sm font-medium">{t('bestMatches')}</CardTitle>
            <Award className="h-5 w-5 text-highlight" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.bestMatches}</div>
            <p className="text-xs text-muted-app mt-1">{t('topLocalResults')}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-highlight" />
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <motion.div key={action.title} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.08 }}>
              <Link href={action.href}>
                <Card className="card-app border-app transition-all cursor-pointer h-full">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className="p-3 rounded-full bg-surface-soft text-accent">
                      <action.icon className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                      <p className="text-sm text-muted-app">{action.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-highlight self-end" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4">{t('recentScans')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentScans.length === 0 ? (
            <Card className="card-app border-app md:col-span-2">
              <CardContent className="p-6 text-muted-app">{t('noScansYet')}</CardContent>
            </Card>
          ) : (
            recentScans.map((scan) => (
              <Card key={scan.id} className="card-app border-app">
                <CardContent className="p-5 space-y-2">
                  <p className="text-white font-medium">{scan.resumes?.file_name || t('resumes')}</p>
                  <p className="text-sm text-muted-app">{t('scoreLabel')}: {scan.match_score}%</p>
                  <p className="text-xs text-muted-app">{new Date(scan.created_at).toLocaleString(language)}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
