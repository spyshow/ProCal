'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import { useTranslation } from '@/i18n';
import {
  FolderOpen,
  Zap,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Building2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  engineer: string;
  location: string;
  preferredManufacturer: string;
  buildings: { id: string; name: string; floors: number; apartmentsPerFloor: number }[];
  apartmentTemplates: { id: string }[];
  loadLibraryItems: { id: string }[];
}

export default function DashboardPage() {
  const { selectedProject, preferredManufacturer } = useProject();
  const { t, isRtl } = useTranslation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : data.projects ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalBuildings = projects.reduce((sum, p) => sum + (p.buildings?.length ?? 0), 0);
  const totalApartments = projects.reduce(
    (sum, p) =>
      sum +
      (p.buildings ?? []).reduce(
        (bSum, b) => bSum + (b.floors ?? 0) * (b.apartmentsPerFloor ?? 0),
        0
      ),
    0
  );

  const statCards = [
    {
      label: t('nav.projects', 'Projects'),
      value: projects.length,
      icon: FolderOpen,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/30',
    },
    {
      label: t('dashboard.totalBuildings', 'Buildings'),
      value: totalBuildings,
      icon: Building2,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/30',
    },
    {
      label: t('projects.buildingsCount', 'Apartments'),
      value: totalApartments,
      icon: Plug,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      label: t('common.connectedLoad', 'Load Items'),
      value: projects.reduce((sum, p) => sum + (p.loadLibraryItems?.length ?? 0), 0),
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
    },
  ];

  const quickLinks = [
    { label: t('nav.projects', 'Projects'), href: '/projects', icon: FolderOpen, desc: t('projects.subtitle', 'Create and manage projects') },
    { label: t('nav.calculator', 'Load Calculator'), href: '/calculator', icon: Zap, desc: t('calculator.subtitle', 'Add loads and size cables') },
    { label: t('nav.panelDesigner', 'Panel Designer'), href: '/panel', icon: Cpu, desc: t('panel.subtitle', 'Design MDB/SMDB layouts') },
    { label: t('nav.riserDiagram', 'Riser Diagram'), href: '/riser', icon: GitBranch, desc: t('nav.riserDiagram', 'Visual vertical riser') },
    { label: t('nav.coordination', 'Coordination'), href: '/coordination', icon: Shield, desc: t('breakers.subtitle', 'TCC selectivity curves') },
    { label: t('nav.reports', 'Reports'), href: '/reports', icon: FileText, desc: t('reports.subtitle', 'BOM and schedules') },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('dashboard.title', 'Dashboard')}</h1>
            <Badge variant="glow">
              {preferredManufacturer || 'Multi-Vendor'} Mode
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {t('dashboard.subtitle', 'Electrical Load Calculation & Switchboard Design Center')}
          </p>
        </div>
        <Link href="/projects">
          <Button variant="glow" className="gap-2">
            <Plus className="w-4 h-4" />
            {t('projects.createNew', 'New Project')}
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="glow-card border-white/10 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-3xl font-bold text-white mt-1 font-mono">
                  {loading ? '—' : value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl border ${bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Navigation Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span> {t('dashboard.quickActions', 'Quick Navigation')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {quickLinks.map(({ label, href, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <Card className="glow-card border-white/10 hover:border-orange-500/40 p-4 group h-full">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 group-hover:bg-orange-500/15 group-hover:border-orange-500/30 flex items-center justify-center transition-colors flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-orange-300 transition-colors flex items-center justify-between">
                      <span>{label}</span>
                      {isRtl ? (
                        <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 group-hover:-translate-x-0.5 transition-all" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> {t('dashboard.recentProjects', 'Recent Projects')}
          </h2>
          <Link href="/projects" className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1">
            <span>{t('dashboard.viewAllProjects', 'View All Projects')}</span>
            <span>{isRtl ? '←' : '→'}</span>
          </Link>
        </div>

        {loading ? (
          <Card className="glow-card p-8 text-center text-slate-400 text-sm">
            {t('dashboard.loadingProjects', 'Loading projects…')}
          </Card>
        ) : projects.length === 0 ? (
          <Card className="glow-card p-8 text-center">
            <FolderOpen className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">{t('dashboard.noActiveProjects', 'No active projects found')}</p>
            <Link href="/projects" className="mt-3 inline-block">
              <Button variant="glow" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> {t('projects.createProject', 'Create First Project')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-3">
            {projects.slice(0, 5).map((proj) => {
              const totalApts = (proj.buildings ?? []).reduce(
                (s, b) => s + (b.floors ?? 0) * (b.apartmentsPerFloor ?? 0),
                0
              );
              return (
                <Link key={proj.id} href={`/projects`}>
                  <Card className="glow-card border-white/10 hover:border-orange-500/40 p-4 group flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 group-hover:text-orange-300 truncate">
                          {proj.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {proj.client || t('projects.noClient', 'No client specified')} · {proj.location || t('projects.noLocation', 'Location pending')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-end hidden sm:block">
                        <p className="text-xs font-mono text-slate-300 font-semibold">
                          {(proj.buildings ?? []).length} {t('projects.buildingsCount', 'Buildings')}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {totalApts} {t('calculator.apartments', 'Apartments')}
                        </p>
                      </div>
                      {isRtl ? (
                        <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-orange-400 group-hover:-translate-x-1 transition-all" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
