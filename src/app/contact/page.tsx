'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Mail,
  Building2,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProCalLogo } from '@/components/brand/ProCalLogo';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.message.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[var(--background-color,#030712)] text-[var(--foreground-color,#f8fafc)] flex flex-col justify-between">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-color,rgba(255,255,255,0.1))] bg-[var(--card-bg,#030712)]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
              <ProCalLogo size={20} />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-[var(--foreground-color,#fff)]">
                ProCal
              </span>
              <span className="block text-[10px] text-orange-400 font-mono uppercase -mt-1">
                Engineering Support
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Home
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="glow" size="sm" className="gap-1.5 text-xs">
                Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <Badge variant="glow" className="mb-3">
            Enterprise &amp; Custom Engineering Support
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground-color,#fff)]">
            Contact the ProCal Engineering Team
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--table-header-color,#94a3b8)] max-w-2xl mx-auto">
            Need custom switchgear catalogs, enterprise multi-seat licensing, or assistance modeling a complex low-voltage distribution project? Reach out directly below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card className="border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]">
              <CardHeader className="pb-2">
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-2">
                  <Mail className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm">Direct Engineering Desk</CardTitle>
                <CardDescription className="text-xs">
                  IEC 60364 / 60909 / 61439 calculation &amp; catalog inquiries
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs font-mono text-orange-400">
                engineering@procal.io
              </CardContent>
            </Card>

            <Card className="border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]">
              <CardHeader className="pb-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                  <Building2 className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm">Project Credits &amp; Licensing</CardTitle>
                <CardDescription className="text-xs">
                  Already signed in? Request project credits directly from your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/billing" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline">
                  Open Credit Request Portal <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card className="md:col-span-2 border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]">
            <CardHeader>
              <CardTitle className="text-lg">Send an Engineering Inquiry</CardTitle>
              <CardDescription className="text-xs">
                Tell us about your project scope, required standards, or team size.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">Inquiry Received</h3>
                  <p className="text-xs text-slate-300">
                    Thank you! Our electrical engineering team will reply to <span className="font-mono text-emerald-300">{form.email}</span> shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-medium text-slate-400 mb-1">
                        Your Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Eng. Ahmad Al-Mansoor"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-medium text-slate-400 mb-1">
                        Work Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="engineer@consultancy.com"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-company" className="block text-xs font-medium text-slate-400 mb-1">
                      Consultancy / Organization
                    </label>
                    <input
                      id="contact-company"
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder="MEP Engineering Group"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-medium text-slate-400 mb-1">
                      Project / Licensing Details *
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Describe your project requirements, custom switchgear catalog needs, or seat count..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <Button type="submit" variant="glow" className="w-full sm:w-auto gap-2 text-xs">
                    <Send className="w-3.5 h-3.5" />
                    Send Message
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color,#1f2937)] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-orange-500" />
            <span>ProCal — Low Voltage Electrical Design, Solved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/tools" className="hover:text-white">Free Tools</Link>
            <Link href="/login" className="hover:text-white">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
