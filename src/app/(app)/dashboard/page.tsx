'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import {
  FolderOpen,
  Zap,
  Cpu,
  GitBranch,
  Shield,
  FileText,
  Building2,
  ArrowRight,
  Plus,
  TrendingUp,
  Plug,
} from 'lucide-react';

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
      label: 'Projects',
      value: projects.length,
      icon: FolderOpen,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Buildings',
      value: totalBuildings,
      icon: Building2,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Apartments',
      value: totalApartments,
      icon: Plug,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Load Items',
      value: projects.reduce((sum, p) => sum + (p.loadLibraryItems?.length ?? 0), 0),
      icon: Zap,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
  ];

  const quickLinks = [
    { label: 'Projects', href: '/projects', icon: FolderOpen, desc: 'Create and manage projects' },
    { label: 'Load Calculator', href: '/calculator', icon: Zap, desc: 'Add loads and size cables' },
    { label: 'Panel Designer', href: '/panel', icon: Cpu, desc: 'Design MDB/SMDB layouts' },
    { label: 'Riser Diagram', href: '/riser', icon: GitBranch, desc: 'Visual vertical riser' },
    { label: 'Coordination', href: '/coordination', icon: Shield, desc: 'TCC selectivity curves' },
    { label: 'Reports', href: '/reports', icon: FileText, desc: 'BOM and schedules' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Electrical Load &amp; MDB Designer — {preferredManufacturer} mode
          </p>
        </div>
        <Link
          href="/projects"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 flex items-center gap-4"
          >
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white leading-none">
                {loading ? '—' : value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
          Quick Navigation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map(({ label, href, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-orange-500/40 hover:bg-gray-800/40 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-800 group-hover:bg-orange-500/15 flex items-center justify-center transition-colors flex-shrink-0">
                <Icon size={18} className="text-gray-400 group-hover:text-orange-400 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-200 group-hover:text-orange-300 transition-colors flex items-center gap-1.5">
                  {label}
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Recent Projects
          </h2>
          <Link href="/projects" className="text-xs text-orange-500 hover:text-orange-400">
            View All
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-500 text-sm">
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center">
            <FolderOpen size={32} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No projects yet</p>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-orange-500 hover:text-orange-400"
            >
              <Plus size={14} />
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.slice(0, 5).map((proj) => {
              const totalApts = proj.buildings.reduce(
                (s, b) => s + b.floors * b.apartmentsPerFloor,
                0
              );
              return (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-orange-500/40 transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200 group-hover:text-orange-300 truncate">
                      {proj.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {proj.client || 'No client'} · {proj.location || 'No location'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono text-gray-300">
                      {proj.buildings.length} bldg{proj.buildings.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {totalApts} apt{totalApts !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-600 group-hover:text-orange-400 transition-colors flex-shrink-0"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
