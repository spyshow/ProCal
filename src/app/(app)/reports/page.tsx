'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
  FileText,
  Printer,
  Table,
  Building2,
} from 'lucide-react';
import { calculateThreePhaseCurrent } from '@/lib/calculations/loads';
import type { FloorItem, Project, ReportTab } from '@/types';

declare global {
  interface Window {
    PagedConfig?: { auto: boolean };
  }
}

export default function ReportsPage() {
  const { selectedProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [company, setCompany] = useState<{ companyName: string; logoUrl: string }>({ companyName: "", logoUrl: "" });

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        if (!selectedBuilding && data.buildings.length > 0) setSelectedBuilding(data.buildings[0].id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [selectedBuilding, selectedProjectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { if (data.company) setCompany(data.company); })
      .catch(() => {});
  }, []);

  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    const printOnly = printRef.current;
    if (!printOnly) return;

    setIsPrinting(true);

    // Use setTimeout to ensure DOM updates before print
    setTimeout(() => {
      window.print();

      // Hide print div after print dialog closes
      const hidePrint = () => {
        setIsPrinting(false);
      };

      // Listen for afterprint event (fires when print dialog closes)
      window.addEventListener('afterprint', hidePrint, { once: true });

      // Fallback: hide after 2 seconds if afterprint doesn't fire
      setTimeout(() => {
        setIsPrinting(false);
        window.removeEventListener('afterprint', hidePrint);
      }, 2000);
    }, 100);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><p className="text-gray-500 text-sm">Loading…</p></div>;
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText size={40} className="text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No project data. Select a project first.</p>
      </div>
    );
  }

  // Aggregate all items across floors
  const allItems: (FloorItem & { floor: number; building: string; phases?: number; hasFloorSubPanels?: boolean })[] = [];
  for (const b of project.buildings) {
    for (const fd of b.floorDesigns) {
      for (const item of fd.items) {
        allItems.push({
          ...item,
          floor: fd.floorNumber,
          building: b.name,
          phases: item.apartmentTemplate?.phases,
          hasFloorSubPanels: (fd as any).hasFloorSubPanels,
        });
      }
    }
  }

  // BOM aggregation
  const cableBOM: Record<string, { size: string; length: number; count: number }> = {};
  const breakerBOM: Record<string, { rating: string; count: number }> = {};
  for (const item of allItems) {
    const cableKey = item.cableSize;
    if (!cableBOM[cableKey]) cableBOM[cableKey] = { size: item.cableSize, length: 0, count: 0 };
    cableBOM[cableKey].length += (item as any).cableLength || (10 + (item.floor - 1) * 5);
    cableBOM[cableKey].count += 1;
    const breakerKey = item.breakerSize;
    if (!breakerBOM[breakerKey]) breakerBOM[breakerKey] = { rating: item.breakerSize, count: 0 };
    breakerBOM[breakerKey].count += 1;
  }

  const tabs: { key: ReportTab; label: string; icon: typeof FileText }[] = [
    { key: 'summary', label: 'Project Summary', icon: FileText },
    { key: 'bom', label: 'Bill of Materials', icon: Table },
    { key: 'mdb', label: 'MDB Schedule', icon: Building2 },
    { key: 'cable', label: 'Cable Schedule', icon: Table },
    { key: 'vd', label: 'Voltage Drop', icon: Table },
  ];

  // Helper to render each tab's content (reused in both screen and print sections)
  const renderTabContent = (tab: ReportTab) => {
    switch (tab) {
      case 'summary':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b pb-2">Project Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                ['Project', project.name],
                ['Client', project.client],
                ['Consultant', project.consultant],
                ['Contractor', project.contractor],
                ['Location', project.location],
                ['Engineer', project.engineer],
                ['Date', project.date || new Date().toLocaleDateString()],
                ['System', `${project.voltage}V / ${project.frequency}Hz`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 uppercase">{label}</p>
                  <p className="font-semibold">{value || '—'}</p>
                </div>
              ))}
            </div>
            <h3 className="font-bold border-b pb-1 mt-4">Building Summary</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Building</th>
                  <th className="border p-2 text-center">Floors</th>
                  <th className="border p-2 text-center">Apts/Floor</th>
                  <th className="border p-2 text-center">Total Apts</th>
                  <th className="border p-2 text-right">Total Demand (kW)</th>
                  <th className="border p-2 text-right">Main Current (A)</th>
                </tr>
              </thead>
              <tbody>
                {project.buildings.map((b) => {
                  const totalApts = b.floors * b.apartmentsPerFloor;
                  const totalDemand = b.floorDesigns.reduce(
                    (s, fd) => s + fd.items.reduce((s2, i) => s2 + i.calculatedMaxDemand, 0), 0
                  );
                  const mainCurrent = calculateThreePhaseCurrent(totalDemand * 1000, project.voltage);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold">{b.name}</td>
                      <td className="border p-2 text-center">{b.floors}</td>
                      <td className="border p-2 text-center">{b.apartmentsPerFloor}</td>
                      <td className="border p-2 text-center">{totalApts}</td>
                      <td className="border p-2 text-right font-mono">{totalDemand.toFixed(1)}</td>
                      <td className="border p-2 text-right font-mono text-orange-600">{mainCurrent.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <h3 className="font-bold border-b pb-1 mt-4">Apartment Templates</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Template</th>
                  <th className="border p-2 text-center">Phase</th>
                  <th className="border p-2 text-right">Area (m²)</th>
                  <th className="border p-2 text-center">Rooms</th>
                  <th className="border p-2 text-right">Connected (kW)</th>
                </tr>
              </thead>
              <tbody>
                {project.apartmentTemplates.map((t) => {
                  const totalArea = t.rooms?.reduce((sum, r) => sum + r.area, 0) || 0;
                  const totalLoad = t.rooms?.reduce((sum, r) => sum + r.connectedLoad, 0) || 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold">{t.name}</td>
                      <td className="border p-2 text-center font-mono">{t.phases === 3 ? '3Φ' : '1Φ'}</td>
                      <td className="border p-2 text-right font-mono">{totalArea.toFixed(1)}</td>
                      <td className="border p-2 text-center font-mono">{t.rooms?.length || 0}</td>
                      <td className="border p-2 text-right font-mono">{(totalLoad / 1000).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      case 'bom':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b pb-2">Bill of Materials (BOM)</h2>
            <h3 className="font-bold">Cable Schedule</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Size (mm²)</th>
                  <th className="border p-2 text-right">Circuits</th>
                  <th className="border p-2 text-right">Est. Length (m)</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(cableBOM).map((entry) => (
                  <tr key={entry.size} className="hover:bg-gray-50">
                    <td className="border p-2 font-mono font-semibold">{entry.size} mm²</td>
                    <td className="border p-2 text-right font-mono">{entry.count}</td>
                    <td className="border p-2 text-right font-mono">{entry.length}m</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td className="border p-2">TOTAL</td>
                  <td className="border p-2 text-right font-mono">{allItems.length}</td>
                  <td className="border p-2 text-right font-mono">{Object.values(cableBOM).reduce((s, e) => s + e.length, 0)}m</td>
                </tr>
              </tbody>
            </table>
            <h3 className="font-bold mt-4">Breaker Schedule</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Rating (A)</th>
                  <th className="border p-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(breakerBOM).map((entry) => (
                  <tr key={entry.rating} className="hover:bg-gray-50">
                    <td className="border p-2 font-mono font-semibold">{entry.rating}</td>
                    <td className="border p-2 text-right font-mono">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'mdb':
        // Group items by building+floor for sub-panel logic
        const floorGroups: Record<string, { building: string; floor: number; hasSubPanel: boolean; items: typeof allItems }> = {};
        for (const item of allItems) {
          const key = `${item.building}-F${item.floor}`;
          if (!floorGroups[key]) {
            floorGroups[key] = { building: item.building, floor: item.floor, hasSubPanel: !!item.hasFloorSubPanels, items: [] };
          }
          floorGroups[key].items.push(item);
        }

        let mdbIndex = 0;
        const mdbRows: { idx: number; building: string; floor: number; feeder: string; type: string; demand: number; current: number; breaker: string; cable: string; isSubPanel?: boolean }[] = [];
        for (const fg of Object.values(floorGroups).sort((a, b) => b.floor - a.floor)) {
          if (fg.hasSubPanel && fg.items.length > 0) {
            // Sub-panel feeder row: sum of all apartment demands on this floor
            const floorDemand = fg.items.reduce((s, i) => s + i.calculatedMaxDemand, 0);
            const floorCurrent = fg.items.reduce((s, i) => s + i.calculatedCurrent, 0);
            mdbIndex++;
            mdbRows.push({
              idx: mdbIndex,
              building: fg.building,
              floor: fg.floor,
              feeder: `Floor ${fg.floor} Sub-Panel`,
              type: 'SUB_PANEL',
              demand: floorDemand,
              current: floorCurrent,
              breaker: `${Math.ceil(floorCurrent)}A`,
              cable: fg.items[0]?.cableSize || '',
              isSubPanel: true,
            });
          }
          for (const item of fg.items) {
            mdbIndex++;
            mdbRows.push({
              idx: mdbIndex,
              building: item.building,
              floor: item.floor,
              feeder: item.name,
              type: item.type,
              demand: item.calculatedMaxDemand,
              current: item.calculatedCurrent,
              breaker: item.breakerSize,
              cable: item.cableSize,
            });
          }
        }

        return (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">MDB Feeder Schedule</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">#</th>
                  <th className="border p-2 text-left">Building</th>
                  <th className="border p-2 text-left">Floor</th>
                  <th className="border p-2 text-left">Feeder</th>
                  <th className="border p-2 text-center">Type</th>
                  <th className="border p-2 text-right">Demand (kW)</th>
                  <th className="border p-2 text-right">Per-Phase Current (A)</th>
                  <th className="border p-2 text-center">Breaker</th>
                  <th className="border p-2 text-center">Cable</th>
                </tr>
              </thead>
              <tbody>
                {mdbRows.map((row) => (
                  <tr key={row.idx} className={row.isSubPanel ? 'bg-orange-50 font-semibold' : 'hover:bg-gray-50'}>
                    <td className="border p-2 font-mono text-gray-500">{row.idx}</td>
                    <td className="border p-2">{row.building}</td>
                    <td className="border p-2 text-center font-mono">F{row.floor}</td>
                    <td className="border p-2 font-semibold">{row.feeder}</td>
                    <td className="border p-2 text-center text-xs">{row.type.replace('_', ' ')}</td>
                    <td className="border p-2 text-right font-mono">{row.demand.toFixed(2)}</td>
                    <td className="border p-2 text-right font-mono text-orange-600">{row.current.toFixed(1)}</td>
                    <td className="border p-2 text-center font-mono text-blue-600">{row.breaker}</td>
                    <td className="border p-2 text-center font-mono text-green-600">{row.cable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'cable':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Cable Sizing Schedule</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Circuit</th>
                  <th className="border p-2 text-center">Phase</th>
                  <th className="border p-2 text-right">Per-Phase Current (A)</th>
                  <th className="border p-2 text-center">Breaker (A)</th>
                  <th className="border p-2 text-center">Cable (mm²)</th>
                  <th className="border p-2 text-center">Method</th>
                  <th className="border p-2 text-center">Insulation</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2 font-semibold">{item.name}</td>
                    <td className="border p-2 text-center font-mono">{item.phases === 3 ? '3Φ' : item.type === 'APARTMENT' ? '1Φ' : '3Φ'}</td>
                    <td className="border p-2 text-right font-mono">{item.calculatedCurrent.toFixed(1)}</td>
                    <td className="border p-2 text-center font-mono text-blue-600">{item.breakerSize}</td>
                    <td className="border p-2 text-center font-mono text-green-600">{item.cableSize}</td>
                    <td className="border p-2 text-center text-xs text-gray-500">{(item as any).installMethod || 'C'}</td>
                    <td className="border p-2 text-center text-xs text-gray-500">{(item as any).cableInsulation || 'XLPE'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'vd':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Voltage Drop Schedule</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Circuit</th>
                  <th className="border p-2 text-right">Per-Phase Current (A)</th>
                  <th className="border p-2 text-center">Cable (mm²)</th>
                  <th className="border p-2 text-right">Est. Length (m)</th>
                  <th className="border p-2 text-right">VDrop (%)</th>
                  <th className="border p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map((item, i) => {
                  const vd = item.voltageDrop ?? 0;
                  const status = vd <= 3 ? 'OK' : vd <= 5 ? 'WARNING' : 'FAIL';
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border p-2 font-semibold">{item.name}</td>
                      <td className="border p-2 text-right font-mono">{item.calculatedCurrent.toFixed(1)}</td>
                      <td className="border p-2 text-center font-mono">{item.cableSize}</td>
                      <td className="border p-2 text-right font-mono">{(item as any).cableLength || (10 + (item.floor - 1) * 5)}</td>
                      <td className="border p-2 text-right font-mono">{vd.toFixed(2)}%</td>
                      <td className={`border p-2 text-center font-semibold ${status === 'OK' ? 'text-green-600' : status === 'WARNING' ? 'text-yellow-600' : 'text-red-600'}`}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">IEC 60364-5-52 limits: 3% for lighting, 5% for power loads</p>
          </div>
        );
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto print:p-0 print:w-full print:max-w-none print:m-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-orange-500" />
            Reports &amp; Schedules
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.name}</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      {project.buildings.length > 1 && (
        <div className="flex gap-2 print:hidden">
          {project.buildings.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuilding(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedBuilding === b.id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-800 print:hidden">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Active tab (screen only) */}
      <div className="screen-only-report bg-white text-gray-900 rounded-xl p-6">
        {renderTabContent(activeTab)}
      </div>

      {/* ========== PRINT-ONLY: ALL TABS ========== */}
      <div ref={printRef} id="print-all-tabs" style={{ display: isPrinting ? 'block' : 'none' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            {(project.logoUrl || company.logoUrl) && (
              <img src={project.logoUrl || company.logoUrl} alt="Logo" style={{ height: '64px', width: 'auto', objectFit: 'contain' }} />
            )}
            <div>
              {company.companyName && <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{company.companyName}</h1>}
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{project.name} — Electrical Design Report</h2>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#4b5563', margin: '4px 0' }}>
            Client: {project.client} | Engineer: {project.engineer} | Date: {project.date || new Date().toLocaleDateString()}
          </p>
          <p style={{ fontSize: '13px', color: '#4b5563', margin: '4px 0' }}>
            Location: {project.location} | Voltage: {project.voltage}V | Frequency: {project.frequency}Hz
          </p>
        </div>

        {tabs.filter(t => t.key !== 'summary').map(({ key }, i) => (
          <div key={key} style={i > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}>
            <div style={{ background: 'white', color: '#111', padding: '16px' }}>
              {renderTabContent(key)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
