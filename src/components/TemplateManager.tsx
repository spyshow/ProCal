'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Template {
  id: string;
  name: string;
  area: number;
  loadDensity: number;
  connectedLoad: number;
  breakerSize: string | null;
  cableSize: string | null;
}

interface TemplateManagerProps {
  projectId: string;
  templates: Template[];
  onRefresh: () => void;
}

export default function TemplateManager({ projectId, templates, onRefresh }: TemplateManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', area: 0, loadDensity: 0 });

  const resetForm = () => {
    setForm({ name: '', area: 0, loadDensity: 0 });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/templates/${editing.id}` : '/api/templates';
    const method = editing ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId }),
    });
    resetForm();
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setForm({ name: t.name, area: t.area, loadDensity: t.loadDensity });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Apartment Templates</h3>
          <p className="text-xs text-slate-400">Reusable apartment unit load templates and protection sizing</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowForm(true); }}
          variant="glow"
          size="sm"
          className="gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Template
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open: boolean) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Apartment Template' : 'Add Apartment Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Template Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Studio 1BR Type A"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-slate-300">Area (m²)</label>
                  <Input
                    value={form.area || ''}
                    onChange={(e) => setForm({ ...form, area: parseFloat(e.target.value) || 0 })}
                    type="number"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-semibold text-slate-300">Load Density (VA/m²)</label>
                  <Input
                    value={form.loadDensity || ''}
                    onChange={(e) => setForm({ ...form, loadDensity: parseFloat(e.target.value) || 0 })}
                    type="number"
                    step="1"
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button type="submit" variant="glow" size="sm">
                {editing ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Template Name</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Density</TableHead>
            <TableHead>Connected Load</TableHead>
            <TableHead>Breaker Size</TableHead>
            <TableHead>Cable Size</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                No templates configured yet
              </TableCell>
            </TableRow>
          ) : (
            templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold text-slate-100">{t.name}</TableCell>
                <TableCell>{t.area} m²</TableCell>
                <TableCell>{t.loadDensity} VA/m²</TableCell>
                <TableCell className="font-mono text-orange-400 font-bold">{t.connectedLoad.toLocaleString()} VA</TableCell>
                <TableCell>
                  {t.breakerSize ? <Badge variant="default" className="font-mono">{t.breakerSize}</Badge> : '—'}
                </TableCell>
                <TableCell>
                  {t.cableSize ? <Badge variant="secondary" className="font-mono">{t.cableSize}</Badge> : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button onClick={() => startEdit(t)} variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-orange-400" />
                    </Button>
                    <Button onClick={() => handleDelete(t.id)} variant="ghost" size="icon" className="h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
