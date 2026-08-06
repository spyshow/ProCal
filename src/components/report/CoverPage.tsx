'use client';

import { phaseBalance } from '@/lib/calculations/phaseBalance';
import { sizeTransformer } from '@/lib/calculations/loads';
import type { Project } from '@/types';

export interface CoverPageProps {
  project: Project;
  companyName?: string;
  companyLogoUrl?: string;
}

export default function CoverPage({
  project,
  companyName,
  companyLogoUrl,
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
  const demandKva = totalDemandKw / (project.powerFactor || 0.85);
  const transformerKva = project.transformerSize || sizeTransformer(demandKva);

  return (
    <section
      aria-label="Report cover page"
      className="cover-page relative bg-white text-slate-900 p-6 flex flex-col justify-between font-sans box-border overflow-hidden"
      style={{
        maxHeight: '275mm', // Fits strictly inside 1 A4 page
        pageBreakAfter: 'always',
        breakAfter: 'page',
      }}
    >
      <div>
        {/* Document Header Bar — matching SLD Executive style */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4 bg-slate-900 text-white p-4 rounded-xl shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded uppercase tracking-wider font-mono">
                Executive Engineering Report
              </span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase mt-1">
              {project.name}
            </h1>
            <p className="text-xs font-semibold text-slate-300">
              ELECTRICAL DESIGN &amp; INFRASTRUCTURE REPORT
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Prepared in accordance with IEC 60364 &amp; BS 7671 Electrical Regulations
            </p>
          </div>
          <div className="text-right text-xs space-y-0.5 font-mono text-slate-300 flex flex-col items-end">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayLogo}
                alt={`${displayCompany} logo`}
                className="h-10 w-auto object-contain mb-1 bg-white/90 p-1 rounded"
              />
            ) : (
              <div className="font-bold text-sm text-amber-400">{displayCompany}</div>
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
        <div className="grid grid-cols-3 gap-3 mb-4 border border-slate-200 rounded-xl p-3 bg-slate-50/80 text-xs">
          <div className="border-r border-slate-200 pr-2">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Client Name</span>
            <span className="font-bold text-slate-900 text-sm">{project.client || 'N/A'}</span>
          </div>
          <div className="border-r border-slate-200 pr-2">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Consultant</span>
            <span className="font-bold text-slate-900 text-sm">{project.consultant || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Lead Engineer</span>
            <span className="font-bold text-slate-900 text-sm">{project.engineer || 'N/A'}</span>
          </div>
        </div>

        {/* 1. System Electrical Calculations Summary */}
        <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
          1. System Electrical Calculations Summary
        </h2>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="border border-amber-200 rounded-xl p-2.5 text-center bg-amber-50/60">
            <span className="text-[10px] font-bold uppercase text-amber-800 block">Total Max Demand</span>
            <span className="text-base font-black text-amber-950">{totalDemandKw.toFixed(1)} kW</span>
          </div>
          <div className="border border-sky-200 rounded-xl p-2.5 text-center bg-sky-50/60">
            <span className="text-[10px] font-bold uppercase text-sky-800 block">Calculated Current</span>
            <span className="text-base font-black text-sky-950">{totalCurrentA.toFixed(1)} A</span>
          </div>
          <div className="border border-emerald-200 rounded-xl p-2.5 text-center bg-emerald-50/60">
            <span className="text-[10px] font-bold uppercase text-emerald-800 block">System Voltage</span>
            <span className="text-base font-black text-emerald-950">{project.voltage}V 3-Phase</span>
          </div>
          <div className="border border-purple-200 rounded-xl p-2.5 text-center bg-purple-50/60">
            <span className="text-[10px] font-bold uppercase text-purple-800 block">Utility Transformer</span>
            <span className="text-base font-black text-purple-950">{transformerKva} kVA ({project.voltage}V)</span>
          </div>
        </div>

        {/* 2. Project Distribution Hierarchy & Infrastructure */}
        <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
          2. Project Distribution Hierarchy &amp; Infrastructure
        </h2>
        <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden mb-4">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="p-2 border-r border-slate-800">Building / Structure</th>
              <th className="p-2 border-r border-slate-800">Floors</th>
              <th className="p-2 border-r border-slate-800">Distribution Panels (SDB/DB)</th>
              <th className="p-2 border-r border-slate-800">Feeder Cable Specs</th>
              <th className="p-2">Max Demand (kW)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {project.buildings?.map((bldg, idx) => {
              const bldgItems = [
                ...bldg.floorDesigns.flatMap((fd) => fd.items),
                ...(bldg.buildingLoads ?? []),
              ];
              const bldgBalance = phaseBalance(bldgItems as any, project as any);

              return (
                <tr key={bldg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                  <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{bldg.name}</td>
                  <td className="p-2 border-r border-slate-200">{bldg.floors} Floors</td>
                  <td className="p-2 border-r border-slate-200">{bldg.floorDesigns?.length || 0} Sub-Panels</td>
                  <td className="p-2 border-r border-slate-200 font-mono text-[10px] text-slate-700">
                    Rising Main Busbar Trunking (800A)
                  </td>
                  <td className="p-2 font-bold text-slate-900">
                    {bldgBalance.totalKw.toFixed(1)} kW{' '}
                    <span className="text-amber-700 font-mono text-[11px]">
                      ({bldgBalance.maxPhaseCurrent.toFixed(1)}A)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Disclaimer */}
      <div className="pt-2 border-t border-slate-200 text-[9px] text-slate-500 leading-relaxed flex items-center justify-between">
        <span>
          Generated by ProCal Engineering System. Values are based on design inputs and standard electrical calculation methods; verify all field installation details against local regulations and project specifications.
        </span>
        <span className="font-bold text-slate-700 shrink-0 ml-4">Page 1</span>
      </div>
    </section>
  );
}
