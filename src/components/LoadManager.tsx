'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/context/ProjectContext';
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

interface LoadItem {
  id: string;
  name: string;
  category: string;
  power: number;
  voltage: number;
  phase: number;
  powerFactor: number;
  demandFactor: number;
  quantity: number;
  runningCurrent: number;
  startingCurrent: number | null;
  notes: string | null;
}

interface LoadManagerProps {
  projectId: string;
  loads: LoadItem[];
  onRefresh: () => void;
}

const CATEGORIES = ['Lighting', 'Socket', 'AC', 'Pump', 'Elevator', 'Fire Pump', 'Mechanical', 'Other'];

export default function LoadManager({ projectId, loads, onRefresh }: LoadManagerProps) {
  const { isQA, canEdit, currentMemberRole } = useProject();
  const isReadOnly = isQA || !canEdit('calculator') || currentMemberRole === 'QA';

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LoadItem | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'Lighting', power: 0, voltage: 230, phase: 1,
    powerFactor: 0.85, demandFactor: 1.0, quantity: 1, startingCurrent: '', notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', category: 'Lighting', power: 0, voltage: 230, phase: 1,
      powerFactor: 0.85, demandFactor: 1.0, quantity: 1, startingCurrent: '', notes: '' });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const url = editing ? `/api/loads/${editing.id}` : '/api/loads';
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
    if (isReadOnly) return;
    if (!confirm('Delete this load item?')) return;
    await fetch(`/api/loads/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (l: LoadItem) => {
    if (isReadOnly) return;
    setEditing(l);
    setForm({
      name: l.name, category: l.category, power: l.power, voltage: l.voltage,
      phase: l.phase, powerFactor: l.powerFactor, demandFactor: l.demandFactor,
      quantity: l.quantity, startingCurrent: l.startingCurrent?.toString() || '',
      notes: l.notes || '',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Load Library</h3>
          <p className="text-xs text-slate-400">Manage electrical equipment, connected loads, and power factors</p>
        </div>
        {!isReadOnly && (
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            variant="glow"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Load
          </Button>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(open: boolean) => !open && resetForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Load Item' : 'Add New Load Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <label className="block mb-1 text-xs font-semibold text-slate-300">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Corridor Lighting" required />
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-xs font-semibold text-slate-300">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-sm text-slate-100 shadow-sm transition-all focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Power (kW)</label>
                <Input value={form.power || ''} onChange={(e) => setForm({ ...form, power: parseFloat(e.target.value) || 0 })} type="number" step="0.1" required />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Voltage (V)</label>
                <select
                  value={form.voltage}
                  onChange={(e) => setForm({ ...form, voltage: parseInt(e.target.value) })}
                  className="flex h-9 w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-sm text-slate-100 shadow-sm transition-all focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value={230}>230V (1-Ph)</option>
                  <option value={400}>400V (3-Ph)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Phase</label>
                <select
                  value={form.phase}
                  onChange={(e) => setForm({ ...form, phase: parseInt(e.target.value) })}
                  className="flex h-9 w-full rounded-md border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-sm text-slate-100 shadow-sm transition-all focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value={1}>1-Phase</option>
                  <option value={3}>3-Phase</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">PF</label>
                <Input value={form.powerFactor} onChange={(e) => setForm({ ...form, powerFactor: parseFloat(e.target.value) || 0.85 })} type="number" step="0.01" />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Demand Factor</label>
                <Input value={form.demandFactor} onChange={(e) => setForm({ ...form, demandFactor: parseFloat(e.target.value) || 1 })} type="number" step="0.01" />
              </div>
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-300">Quantity</label>
                <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} type="number" min="1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button type="submit" variant="glow" size="sm">
                {editing ? 'Update Load' : 'Create Load'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>kW</TableHead>
            <TableHead>V</TableHead>
            <TableHead>PF</TableHead>
            <TableHead>DF</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Current (A)</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-6 text-slate-500">
                No load items defined yet
              </TableCell>
            </TableRow>
          ) : (
            loads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-semibold text-slate-100">{l.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{l.category}</Badge>
                </TableCell>
                <TableCell className="font-mono">{l.power}</TableCell>
                <TableCell className="font-mono">{l.voltage}V</TableCell>
                <TableCell className="font-mono">{l.powerFactor}</TableCell>
                <TableCell className="font-mono">{l.demandFactor}</TableCell>
                <TableCell className="font-mono">{l.quantity}</TableCell>
                <TableCell className="font-mono text-orange-400 font-bold">{l.runningCurrent} A</TableCell>
                <TableCell className="text-right">
                  {!isReadOnly ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button onClick={() => startEdit(l)} variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5 text-slate-400 hover:text-orange-400" />
                      </Button>
                      <Button onClick={() => handleDelete(l.id)} variant="ghost" size="icon" className="h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
