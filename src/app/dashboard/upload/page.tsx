'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiSend } from '@/lib/local-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, X, Search, Award, CheckCircle2, AlertCircle, FileText, File } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppPreferences } from '@/components/AppPreferencesProvider'

interface UploadedFile {
  id: string
  name: string
  type: string
  size: number
  progress: number
  url?: string
  extractedText?: string
  error?: string
}

interface ScanResult {
  id: string
  resumeId: string
  fileName: string
  fileType: string
  matchScore: number
  matchedKeywords: string[]
  isBestMatch: boolean
}

export default function UploadPage() {
  const { user } = useAuth()
  const { t } = useAppPreferences()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [keywords, setKeywords] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const uploadFiles = useCallback(async (incomingFiles: File[]) => {
    if (!user?.id) {
      toast.error(t('pleaseSignInFirst'))
      return
    }

    const validFiles = incomingFiles.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['pdf', 'docx', 'txt'].includes(ext || '')
    })

    if (!validFiles.length) {
      toast.error(t('uploadSupportedFiles'))
      return
    }

    setIsUploading(true)

    for (const file of validFiles) {
      const tempId = Math.random().toString(36).slice(2)
      setFiles((prev) => [
        ...prev,
        {
          id: tempId,
          name: file.name,
          type: file.type || `application/${file.name.split('.').pop()}`,
          size: file.size,
          progress: 0,
        },
      ])

      try {
        for (let progress = 10; progress <= 70; progress += 20) {
          await new Promise((resolve) => setTimeout(resolve, 80))
          setFiles((prev) => prev.map((f) => (f.id === tempId ? { ...f, progress } : f)))
        }

        const formData = new FormData()
        formData.append('userId', user.id)
        formData.append('file', file)

        const payload = await apiSend<{ resume: { id: string; file_url: string; extracted_text: string } }>('/api/resumes', 'POST', formData)

        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? {
                  ...f,
                  id: payload.resume.id,
                  progress: 100,
                  url: payload.resume.file_url,
                  extractedText: payload.resume.extracted_text,
                }
              : f
          )
        )

        toast.success(`${file.name} ${t('uploadSuccess')}`)
      } catch (error) {
        setFiles((prev) => prev.map((f) => (f.id === tempId ? { ...f, error: error instanceof Error ? error.message : 'Upload failed' } : f)))
      }
    }

    setIsUploading(false)
  }, [user?.id, t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }, [uploadFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || [])
    if (incoming.length) uploadFiles(incoming)
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((file) => file.id !== id))

  const scanResumes = async () => {
    if (!user?.id) {
      toast.error(t('pleaseSignInFirst'))
      return
    }
    const keywordList = keywords.split(',').map((item) => item.trim()).filter(Boolean)
    if (!keywordList.length) return

    setIsScanning(true)
    try {
      const payload = await apiSend<{ results: ScanResult[] }>('/api/scans', 'POST', {
        userId: user.id,
        keywords: keywordList,
      })
      setScanResults(payload.results)
      toast.success(t('scanCompleted'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('scanFailed'))
    }
    setIsScanning(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />
    if (type.includes('word') || type.includes('docx')) return <FileText className="w-5 h-5 text-blue-400" />
    return <File className="w-5 h-5 text-accent" />
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-3xl font-bold text-white">{t('uploadTitle')}</h1>
        <p className="text-muted-app mt-2">{t('uploadSubtitle')}</p>
      </div>

      <Card className="card-app border-app">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-highlight" />
            {t('uploadResumes')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              isDragging ? 'border-accent bg-surface-soft' : 'border-app bg-surface-2'
            }`}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-accent" />
            <p className="text-white font-medium">{t('dragFiles')}</p>
            <p className="text-sm text-muted-app mt-1">PDF, DOCX, TXT</p>
            <label className="inline-block mt-4">
              <input type="file" multiple accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileInput} />
              <span className="inline-flex items-center px-4 py-2 rounded-md bg-accent-app text-on-accent font-semibold cursor-pointer">
                {t('chooseFiles')}
              </span>
            </label>
          </div>

          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-lg border border-app bg-surface-2 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="min-w-0">
                      <p className="text-white truncate">{file.name}</p>
                      <p className="text-sm text-muted-app">{formatFileSize(file.size)}</p>
                      {!file.error && <Progress value={file.progress} className="mt-2" />}
                      {file.error && <p className="text-sm text-red-400 mt-2">{file.error}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                    <X className="w-4 h-4 text-muted-app" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isUploading && <p className="text-sm text-muted-app">{t('uploadingLocally')}</p>}
        </CardContent>
      </Card>

      <Card className="card-app border-app">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-highlight" />
            {t('keywordScan')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t('keywordPlaceholder')}
            className="min-h-28 bg-surface-2 border-app text-white"
          />
          <Button onClick={scanResumes} disabled={isScanning || !files.length} className="bg-accent-app text-on-accent hover:opacity-90">
            {isScanning ? t('scanning') : t('scanResumes')}
          </Button>
        </CardContent>
      </Card>

      {scanResults.length > 0 && (
        <Card className="card-app border-app">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-highlight" />
              {t('scanResults')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanResults.map((result) => (
              <div key={result.id} className="rounded-lg border border-app bg-surface-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{result.fileName}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="border-app text-accent">
                        {t('scoreLabel')}: {result.matchScore}%
                      </Badge>
                      {result.isBestMatch ? (
                        <Badge className="bg-accent-app text-on-accent">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> {t('bestMatch')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-app text-muted-app">
                          <AlertCircle className="w-3 h-3 mr-1" /> {t('standardResult')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-app">{result.fileType}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.matchedKeywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="bg-surface-soft text-accent">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
