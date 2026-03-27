'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Brain, Trophy, Shield, FileText, Zap, Share2, Mail, CheckCircle2 } from 'lucide-react';
import { useAppPreferences } from '@/components/AppPreferencesProvider';

const features = [
  { title: 'AI-Powered Scanning', description: 'Analyze resumes, extract important details, and compare documents quickly.', icon: Brain },
  { title: 'Smart Rankings', description: 'See the strongest matches based on the keywords you provide.', icon: Trophy },
  { title: 'Local Storage', description: 'Files, settings, and scan data stay inside your local project folder.', icon: Shield },
  { title: 'Multi-Format Support', description: 'Upload PDF, DOCX, and TXT resumes in one place.', icon: FileText },
  { title: 'Fast Results', description: 'Get instant local results without external services or API keys.', icon: Zap },
  { title: 'Easy Review', description: 'Open resumes, compare scores, and keep the workflow simple.', icon: Share2 },
];

const teamMembers = [
  { name: 'Sarah Chen', role: 'CEO & Co-Founder', bio: 'Recruitment leader focused on practical hiring workflows.', initials: 'SC' },
  { name: 'Michael Rodriguez', role: 'CTO & Co-Founder', bio: 'Engineer building document and matching systems.', initials: 'MR' },
  { name: 'Emily Watson', role: 'Head of Product', bio: 'Product manager focused on usability and simple processes.', initials: 'EW' },
];

const milestones = [
  { year: '2024', title: 'Platform Launch', description: 'First local workflow for resume scanning and storage.' },
  { year: '2024', title: '10,000 Users', description: 'Reached the first major usage milestone.' },
  { year: '2025', title: 'AI v2.0', description: 'Improved ranking and extraction quality.' },
  { year: '2025', title: 'Enterprise Launch', description: 'Added stronger workflows for teams and analytics.' },
];

export default function AboutPage() {
  const { t } = useAppPreferences();

  return (
    <div className="space-y-12 w-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white">{t('aboutTitle')}</h1>
        <p className="text-lg text-muted-app">{t('aboutSubtitle')}</p>
        <div className="flex items-center justify-center gap-2 text-accent">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm">Local-first workflow for recruiting and resume review</span>
        </div>
      </motion.div>

      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t('featuresTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="card-app border-app h-full">
              <CardHeader>
                <div className="p-3 rounded-lg bg-surface-soft w-fit mb-4">
                  <feature.icon className="h-8 w-8 text-highlight" />
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-app">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t('teamTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <Card key={member.name} className="card-app border-app text-center">
              <CardContent className="p-6 space-y-4">
                <Avatar className="h-20 w-20 mx-auto bg-surface-soft">
                  <AvatarFallback className="text-2xl text-highlight bg-surface-soft">{member.initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold text-white">{member.name}</h3>
                  <Badge className="mt-2 bg-surface-soft text-accent">{member.role}</Badge>
                </div>
                <p className="text-muted-app text-sm">{member.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t('journeyTitle')}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {milestones.map((milestone) => (
            <Card key={`${milestone.year}-${milestone.title}`} className="card-app border-app">
              <CardContent className="p-6">
                <Badge className="bg-accent-app text-on-accent mb-3">{milestone.year}</Badge>
                <h3 className="text-xl font-semibold text-white">{milestone.title}</h3>
                <p className="text-muted-app mt-2">{milestone.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="card-app border-app max-w-2xl mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          <div className="p-4 rounded-full bg-surface-soft w-fit mx-auto">
            <Mail className="h-10 w-10 text-highlight" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('getInTouch')}</h2>
            <p className="text-muted-app">Questions, suggestions, or deployment requests — contact the team directly.</p>
          </div>
          <a href="mailto:contact@hirewise.local" className="inline-block px-6 py-3 bg-accent-app text-on-accent font-semibold rounded-lg transition-colors hover:opacity-90">
            contact@hirewise.local
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
