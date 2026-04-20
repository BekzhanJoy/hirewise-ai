'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGet, apiSend, withBackendUrl } from '@/lib/local-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileText, File, Trash2, Search, FileArchive, RefreshCw, Download, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAppPreferences } from '@/components/AppPreferencesProvider'

interface ResumeProfile {
  skills?: string[]
  education_level?: string | null
  years_experience?: number | null
}

interface Resume {
  id: string
  user_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  created_at: string
  best_match_score?: number
  best_match_score_job_description?: number
  best_match_score_keywords?: number
  resume_profile?: ResumeProfile
}

interface JobMatchResult {
  id: string
  resumeId: string
  fileName: string
  fileType: string
  matchScore: number
  matchedKeywords: string[]
  missingSkills: string[]
  summary?: string
  llmExplanation?: string
  skillScore: number
  experienceScore: number
  educationScore: number
  contextScore: number
  isBestMatch: boolean
}

interface JobMatchRun {
  runId: string
  createdAt: string
  jobDescription: string
  results: JobMatchResult[]
}

type SortOption = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc'

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth()
  const { t, language } = useAppPreferences()
  const [resumes, setResumes] = useState<Resume[]>([])
  const [filteredResumes, setFilteredResumes] = useState<Resume[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date_desc')
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [jobMatchRuns, setJobMatchRuns] = useState<JobMatchRun[]>([])

  const fetchResumes = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const payload = await apiGet<{ resumes: Resume[] }>(`/api/resumes?userId=${encodeURIComponent(user.id)}`)
      setResumes(payload.resumes)
      const historyPayload = await apiGet<{ runs: JobMatchRun[] }>(`/api/scans/history?userId=${encodeURIComponent(user.id)}`)
      setJobMatchRuns(historyPayload.runs || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load resumes')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setIsLoading(false)
      return
    }
    fetchResumes()
  }, [user?.id, authLoading])

  useEffect(() => {
    const next = [...resumes].filter((resume) => resume.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
    switch (sortBy) {
      case 'date_desc':
        next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'date_asc':
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'score_desc':
        next.sort((a, b) => (b.best_match_score || 0) - (a.best_match_score || 0))
        break
      case 'score_asc':
        next.sort((a, b) => (a.best_match_score || 0) - (b.best_match_score || 0))
        break
    }
    setFilteredResumes(next)
  }, [resumes, searchQuery, sortBy])

  const deleteResume = async (resumeId: string) => {
    if (!user?.id) return
    setDeletingId(resumeId)
    try {
      await apiSend(`/api/resumes?userId=${encodeURIComponent(user.id)}&resumeId=${encodeURIComponent(resumeId)}`, 'DELETE')
      setResumes((prev) => prev.filter((resume) => resume.id !== resumeId))
      toast.success(t('resumeDeleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete resume')
    }
    setDeletingId(null)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />
    if (type.includes('word') || type.includes('docx')) return <FileText className="w-8 h-8 text-blue-400" />
    return <File className="w-8 h-8 text-muted-app" />
  }

  const getFileTypeBadge = (type: string) => {
    if (type.includes('pdf')) return <Badge variant="outline" className="text-xs border-app text-accent">PDF</Badge>
    if (type.includes('word') || type.includes('docx')) return <Badge variant="outline" className="text-xs border-app text-accent">DOCX</Badge>
    return <Badge variant="outline" className="text-xs border-app text-accent">TXT</Badge>
  }

  if (isLoading) return <div className="text-muted-app">{t('loadingLibrary')}</div>

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-accent">{t('libraryTitle')}</h1>
          <p className="text-sm mt-1 text-muted-app">{resumes.length} {t('filesStoredLocally')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchResumes} className="gap-2 border-app text-accent">
          <RefreshCw className="w-4 h-4" /> {t('refresh')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchResumes')}
            className="pl-10 bg-surface-2 border-app text-accent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-2 rounded-md text-sm outline-none bg-surface-2 border border-app text-accent"
        >
          <option value="date_desc">{t('newestFirst')}</option>
          <option value="date_asc">{t('oldestFirst')}</option>
          <option value="score_desc">{t('highestScore')}</option>
          <option value="score_asc">{t('lowestScore')}</option>
        </select>
      </div>

      {filteredResumes.length === 0 ? (
        <Card className="card-app border-app">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileArchive className="w-16 h-16 mb-4 text-muted-app" />
            <p className="text-lg font-medium text-accent">{searchQuery ? t('noMatchingResumes') : t('noResumesUploaded')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredResumes.map((resume) => (
            <Card key={resume.id} className="group hover:scale-[1.02] transition-transform card-app border-app">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getFileIcon(resume.file_type)}
                    <div className="min-w-0">
                      <p className="font-medium truncate text-accent">{resume.file_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getFileTypeBadge(resume.file_type)}
                        <span className="text-xs text-muted-app">{formatFileSize(resume.file_size)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteResume(resume.id)} disabled={deletingId === resume.id}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>

                <div className="text-xs text-muted-app">{t('uploadedOn')}: {formatDate(resume.created_at)}</div>
                {typeof resume.best_match_score_job_description === 'number' && (
                  <div className="text-sm text-highlight">Best JD score: {resume.best_match_score_job_description}%</div>
                )}
                {typeof resume.best_match_score_keywords === 'number' && (
                  <div className="text-sm text-muted-app">Best keyword score: {resume.best_match_score_keywords}%</div>
                )}

                {(resume.resume_profile?.skills?.length || resume.resume_profile?.education_level || typeof resume.resume_profile?.years_experience === 'number') && (
                  <div className="space-y-2">
                    {resume.resume_profile?.skills?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {resume.resume_profile.skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="secondary" className="bg-surface-soft text-accent">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-app">
                      {resume.resume_profile?.education_level && (
                        <span>{t('educationDetected')}: {resume.resume_profile.education_level}</span>
                      )}
                      {typeof resume.resume_profile?.years_experience === 'number' && (
                        <span>{t('experienceDetected')}: {resume.resume_profile.years_experience}y</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <a
                    href={withBackendUrl(resume.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-surface-soft text-accent text-sm"
                  >
                    <Download className="w-4 h-4" /> {t('open')}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-highlight" />
          Job Match History
        </h2>
        {jobMatchRuns.length === 0 ? (
          <Card className="card-app border-app">
            <CardContent className="p-6 text-muted-app">
              No saved job-fit analyses yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobMatchRuns.map((run) => (
              <Card key={run.runId} className="card-app border-app">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-app">
                      {new Date(run.createdAt).toLocaleString(language)}
                    </div>
                    <Badge variant="outline" className="border-app text-accent">
                      {run.results.length} result(s)
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-app bg-surface-2 p-3">
                    <p className="text-xs text-muted-app mb-2">Job Offer</p>
                    <p className="text-sm text-white whitespace-pre-wrap leading-6">
                      {run.jobDescription}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {run.results.map((result) => (
                      <div key={result.id} className="rounded-lg border border-app bg-surface-2 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-white font-medium">{result.fileName}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-app text-accent">
                              Score: {result.matchScore}%
                            </Badge>
                            {result.isBestMatch ? (
                              <Badge className="bg-accent-app text-on-accent">Best match</Badge>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-sm text-muted-app leading-6">
                          {result.llmExplanation || result.summary || 'No explanation available.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
