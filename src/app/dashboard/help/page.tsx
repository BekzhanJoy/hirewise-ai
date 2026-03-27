'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { HelpCircle, Search, Upload, Key, BarChart3, Eye, Mail, ExternalLink } from 'lucide-react'
import { useAppPreferences } from '@/components/AppPreferencesProvider'

export default function HelpPage() {
  const { t } = useAppPreferences()
  const [searchQuery, setSearchQuery] = useState('')

  const FAQ_ITEMS = useMemo(() => [
    {
      id: 'faq-1',
      question: 'What file formats are supported?',
      answer: 'We support PDF, DOCX, and TXT file formats. PDF files are recommended for best results as they preserve formatting.'
    },
    {
      id: 'faq-2',
      question: 'How does keyword matching work?',
      answer: 'Enter comma-separated keywords, and the system scans all uploaded resumes for matches. The score is calculated as (matched keywords / total keywords) x 100%.'
    },
    {
      id: 'faq-3',
      question: 'Is my data secure?',
      answer: 'Yes. In this local version, files and settings stay inside the project folder on your computer.'
    },
    {
      id: 'faq-4',
      question: 'How do I delete a resume?',
      answer: 'Open the Resume Library page and click the trash icon on the card you want to remove.'
    },
    {
      id: 'faq-5',
      question: 'What does the Best Match badge mean?',
      answer: 'The Best Match badge marks the resume with the highest score in the current scan result list.'
    },
  ], [])

  const GUIDE_STEPS = useMemo(() => [
    { icon: Upload, title: 'Upload', description: 'Add PDF, DOCX, or TXT files to the local project storage.' },
    { icon: Key, title: 'Enter Keywords', description: 'Type comma-separated keywords that you want to find.' },
    { icon: BarChart3, title: 'Scan', description: 'Run the scan to compare all uploaded resumes.' },
    { icon: Eye, title: 'Review', description: 'Open the results and check scores for each candidate.' },
  ], [])


  const filteredFAQ = FAQ_ITEMS.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold text-accent">{t('helpTitle')}</h1>
        <p className="text-sm mt-1 text-muted-app">{t('helpSubtitle')}</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-app" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help articles..."
          className="pl-10 bg-surface-2 border-app text-accent"
        />
      </div>

      <Card className="card-app border-app">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent">
            <HelpCircle className="w-5 h-5" />
            {t('howItWorks')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {GUIDE_STEPS.map((step, index) => (
              <div key={index} className="text-center p-4 rounded-lg bg-surface-2 border border-app">
                <div className="relative inline-block mb-4">
                  <div className="w-14 h-14 rounded-full bg-surface-soft flex items-center justify-center mx-auto">
                    <step.icon className="w-6 h-6 text-accent" />
                  </div>
                  <Badge className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0 flex items-center justify-center bg-accent-app text-on-accent">
                    {index + 1}
                  </Badge>
                </div>
                <p className="font-medium text-accent">{step.title}</p>
                <p className="text-xs mt-1 text-muted-app">{step.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="card-app border-app">
        <CardHeader>
          <CardTitle className="text-accent">{t('faq')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredFAQ.map(item => (
              <AccordionItem key={item.id} value={item.id} className="border-app">
                <AccordionTrigger className="text-accent hover:opacity-80">{item.question}</AccordionTrigger>
                <AccordionContent className="text-muted-app">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {filteredFAQ.length === 0 && (
            <p className="text-center py-8 text-muted-app">{t('noFaqResults')}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card className="card-app border-app">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Mail className="w-5 h-5" />
              {t('contactSupport')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-app">Need more help? Reach out and we will get back to you as soon as possible.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="mailto:support@hirewise.local" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-app text-on-accent">
                <Mail className="w-4 h-4" /> {t('emailSupport')}
              </a>
              <Button variant="outline" className="gap-2 border-app text-accent">
                <ExternalLink className="w-4 h-4" />
                {t('visitDocs')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
