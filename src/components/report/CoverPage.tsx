'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { sizeTransformer } from '@/lib/calculations/loads';
import { computeFeeders } from '@/lib/calculations/feeders';
import type { Project, ProjectRevision } from '@/types';

export interface CoverPageProps {
  project: Project;
  companyName?: string;
  companyLogoUrl?: string;
  revisions?: ProjectRevision[];
}

export default function CoverPage({
  project,
  companyName,
  companyLogoUrl,
  revisions = [],
}: CoverPageProps) {
  const displayLogo = project.logoUrl || companyLogoUrl;
  const displayCompany = companyName || 'ProCal Engineering Suite';
  const reportDate = project.date || new Date().toLocaleDateString();

  // Aggregate project-wide load & current balance
  const allProjectItems = project.buildings.flatMap((b) => [
    ...b.floorDesigns.flatMap((fd) => fd.items),
    ...(b.buildingLoads ?? []),
  ]);
  const totalBalance = phaseBalance(allProjectItems as any, project as any);
  const totalDemandKw = totalBalance.totalKw;
  const totalCurrentA = totalBalance.maxPhaseCurrent;
  const pf = project.powerFactor || 0.85;
  const demandKva = totalDemandKw / pf;
  const perPhaseKva: [number, number, number] = [
    totalBalance.phaseKw[0] / pf,
    totalBalance.phaseKw[1] / pf,
    totalBalance.phaseKw[2] / pf,
  ];
  const transformerKva = project.transformerSize || sizeTransformer(demandKva, 1.2, perPhaseKva);

  return (
    <section
      aria-label="Report cover page"
      className="cover-page w-full bg-white text-slate-900 font-sans box-border"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div className="space-y-2.5">
        {/* Document Header Bar — matching SLD Executive style */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-900 text-white p-2.5 rounded-lg shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded uppercase tracking-wider font-mono">
                Executive Engineering Report
              </span>
            </div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase mt-0.5">
              {project.name}
            </h1>
            <p className="text-[10px] font-semibold text-slate-300">
              ELECTRICAL DESIGN &amp; INFRASTRUCTURE REPORT
            </p>
            <p className="text-[8.5px] text-slate-400">
              Prepared in accordance with IEC 60364 &amp; BS 7671 Electrical Regulations
            </p>
          </div>
          <div className="text-right text-[9.5px] space-y-0.5 font-mono text-slate-300 flex flex-col items-end">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayLogo}
                alt={`${displayCompany} logo`}
                className="h-6 w-auto object-contain mb-0.5 bg-white/90 p-0.5 rounded"
              />
            ) : (
              <div className="font-bold text-xs text-amber-400">{displayCompany}</div>
            )}
            <div>
              Report Ref: <span className="font-semibold text-white">PRJ-{project.id.slice(-6).toUpperCase()}</span>
            </div>
            <div>
              Date: <span className="font-semibold text-white">{reportDate}</span>
            </div>
          </div>
        </div>

        {/* Project Metadata Cards */}
        <div className="grid grid-cols-3 gap-2.5 border border-slate-200 rounded-lg p-1.5 bg-slate-50/80 text-xs">
          <div className="border-r border-slate-200 pr-2">
            <span className="text-slate-500 block text-[8.5px] uppercase font-bold tracking-wider">Client Name</span>
            <span className="font-bold text-slate-900 text-[11px]">{project.client || 'N/A'}</span>
          </div>
          <div className="border-r border-slate-200 pr-2">
            <span className="text-slate-500 block text-[8.5px] uppercase font-bold tracking-wider">Consultant</span>
            <span className="font-bold text-slate-900 text-[11px]">{project.consultant || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[8.5px] uppercase font-bold tracking-wider">Lead Engineer</span>
            <span className="font-bold text-slate-900 text-[11px]">{project.engineer || 'N/A'}</span>
          </div>
        </div>

        {/* 1. System Electrical Calculations Summary (4 KPI Cards) */}
        <div>
          <h2 className="text-[10.5px] font-bold text-slate-900 uppercase mb-1 border-l-4 border-amber-500 pl-2">
            1. System Electrical Calculations Summary
          </h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="border border-amber-200 rounded-lg p-1.5 text-center bg-amber-50/60">
              <span className="text-[8.5px] font-bold uppercase text-amber-800 block">Total Max Demand</span>
              <span className="text-xs font-black text-amber-950 font-mono">{totalDemandKw.toFixed(1)} kW</span>
            </div>
            <div className="border border-sky-200 rounded-lg p-1.5 text-center bg-sky-50/60">
              <span className="text-[8.5px] font-bold uppercase text-sky-800 block">Calculated Current</span>
              <span className="text-xs font-black text-sky-950 font-mono">{totalCurrentA.toFixed(1)} A</span>
            </div>
            <div className="border border-emerald-200 rounded-lg p-1.5 text-center bg-emerald-50/60">
              <span className="text-[8.5px] font-bold uppercase text-emerald-800 block">System Voltage</span>
              <span className="text-xs font-black text-emerald-950 font-mono">{project.voltage}V 3-Phase</span>
            </div>
            <div className="border border-purple-200 rounded-lg p-1.5 text-center bg-purple-50/60">
              <span className="text-[8.5px] font-bold uppercase text-purple-800 block">Utility Transformer</span>
              <span className="text-xs font-black text-purple-950 font-mono">{transformerKva} kVA ({project.voltage}V)</span>
            </div>
          </div>
        </div>

        {/* 2. Project Distribution Hierarchy & Infrastructure (Full Width) */}
        <div>
          <h2 className="text-[10.5px] font-bold text-slate-900 uppercase mb-1 border-l-4 border-amber-500 pl-2">
            2. Project Distribution Hierarchy &amp; Infrastructure
          </h2>
          <table className="w-full text-left text-[9.5px] border border-slate-300 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-900 text-white text-[8.5px] font-bold uppercase tracking-wider">
                <th className="p-1.5 border-r border-slate-800 whitespace-nowrap">Building / Structure</th>
                <th className="p-1.5 border-r border-slate-800 text-center whitespace-nowrap">Floors</th>
                <th className="p-1.5 border-r border-slate-800 text-center whitespace-nowrap">Main Incomer Breaker</th>
                <th className="p-1.5 border-r border-slate-800 text-center whitespace-nowrap">Main Feeder Cable</th>
                <th className="p-1.5 border-r border-slate-800 text-center whitespace-nowrap">Distribution Panels</th>
                <th className="p-1.5 text-right whitespace-nowrap">Max Demand (kW / Amps)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {project.buildings?.map((bldg, idx) => {
                const bldgItems = [
                  ...bldg.floorDesigns.flatMap((fd) => fd.items),
                  ...(bldg.buildingLoads ?? []),
                ];
                const bldgBalance = phaseBalance(bldgItems as any, project as any);
                const { mainBreakerIn, mainCableSize, mainParallelRuns } = computeFeeders(bldg, project, () => ({
                  model: null,
                  manufacturer: null,
                  familyName: null,
                  ratedCurrent: null,
                  fallback: true,
                  fallbackType: 'GENERIC_SPEC',
                }));
                const incomerCat = mainBreakerIn >= 630 ? 'ACB' : 'MCCB';
                const cableSpec = mainParallelRuns > 1
                  ? `${mainParallelRuns} × (4C × ${mainCableSize} mm²)`
                  : `4C × ${mainCableSize} mm²`;

                return (
                  <tr key={bldg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">{bldg.name}</td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono whitespace-nowrap">{bldg.floors} Floors</td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[9px]">
                        {mainBreakerIn}A {incomerCat}
                      </span>
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono text-[9px] text-slate-700 whitespace-nowrap">
                      {cableSpec}
                    </td>
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono text-[9px] text-slate-600 whitespace-nowrap">
                      {bldg.floorDesigns?.length || 0} Sub-Panels
                    </td>
                    <td className="p-1.5 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                      {bldgBalance.totalKw.toFixed(1)} kW{' '}
                      <span className="text-amber-700 text-[9px]">({bldgBalance.maxPhaseCurrent.toFixed(1)}A)</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. Document Revisions & Engineering QC Approval (Full Width Grid) */}
        <div className="grid grid-cols-12 gap-3 items-start">
          {/* Left Column (8 cols): Document Revisions History */}
          <div className="col-span-8">
            <h2 className="text-[10.5px] font-bold text-slate-900 uppercase mb-1 border-l-4 border-amber-500 pl-2">
              3. Document Revisions History
            </h2>
            <table className="w-full text-left text-[9px] border border-slate-300 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[8px]">
                  <th className="p-1 border-r border-slate-800 w-10 whitespace-nowrap">Rev</th>
                  <th className="p-1 border-r border-slate-800 w-20 whitespace-nowrap">Date</th>
                  <th className="p-1 border-r border-slate-800 whitespace-nowrap">Description</th>
                  <th className="p-1 w-24 whitespace-nowrap">Prepared By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {revisions.length === 0 ? (
                  <tr>
                    <td className="p-1 border-r border-slate-200 font-mono font-bold whitespace-nowrap">R0</td>
                    <td className="p-1 border-r border-slate-200 whitespace-nowrap">{reportDate}</td>
                    <td className="p-1 border-r border-slate-200 whitespace-nowrap">Initial engineering release</td>
                    <td className="p-1 whitespace-nowrap">{project.engineer || 'Lead Engineer'}</td>
                  </tr>
                ) : (
                  [...revisions]
                    .sort((a, b) => (a.rev > b.rev ? -1 : 1))
                    .slice(0, 3)
                    .map((r, idx) => (
                      <tr key={r.id} className={idx === 0 ? 'bg-amber-50/80 font-semibold' : ''}>
                        <td className="p-1 border-r border-slate-200 font-mono font-bold whitespace-nowrap">{r.rev}</td>
                        <td className="p-1 border-r border-slate-200 whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-1 border-r border-slate-200 truncate max-w-[220px]">{r.description}</td>
                        <td className="p-1 truncate max-w-[90px]">{r.createdByUsername}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Right Column (4 cols): Engineering QC Approval & Stamp */}
          <div className="col-span-4 space-y-1">
            <h2 className="text-[10.5px] font-bold text-slate-900 uppercase mb-1 border-l-4 border-emerald-500 pl-2">
              Engineering Sign-Off
            </h2>
            <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50/80 text-[8.5px]">
              <div className="grid grid-cols-3 gap-1 text-center font-mono">
                <div className="border-r border-slate-200 pr-1">
                  <span className="text-slate-400 block text-[7.5px] uppercase">Designed</span>
                  <span className="font-bold text-slate-800 truncate block">{project.engineer || 'Lead Eng.'}</span>
                </div>
                <div className="border-r border-slate-200 pr-1">
                  <span className="text-slate-400 block text-[7.5px] uppercase">QC Check</span>
                  <span className="font-bold text-slate-800 block">QC Dept</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[7.5px] uppercase">Status</span>
                  <span className="font-bold text-emerald-700 block">APPROVED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Disclaimer — pinned at bottom */}
      <div className="pt-1.5 border-t border-slate-200 text-[8px] text-slate-500 leading-relaxed flex items-center justify-between mt-2">
        <span>
          Generated by ProCal Engineering System. Values are based on standard electrical calculation methods (IEC 60364 / BS 7671).
        </span>
        <span className="font-bold text-slate-700 shrink-0 ml-4 font-mono">Page 1</span>
      </div>
    </section>
  );
}
