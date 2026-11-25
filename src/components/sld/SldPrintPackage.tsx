'use client';

import { SchematexDiagram } from 'schematex/react';
import type { SLDPage as SLDPageType } from '@/lib/sld/generator';
import type { Project } from '@/types';

export interface SldPrintPackageProps {
  project: Project;
  pages: SLDPageType[];
  isPrintingAll: boolean;
  projectMetrics: {
    totalPower: number;
    totalPowerKw?: number;
    totalCurrent: number;
  };
}

export function SldPrintPackage({
  project,
  pages,
  isPrintingAll,
  projectMetrics,
}: SldPrintPackageProps) {
  return (
    <>
      {project?.isTrial && (
        <div
          aria-hidden="true"
          className="hidden print:flex fixed inset-0 pointer-events-none z-[99999] flex-col justify-around items-center opacity-15 overflow-hidden"
        >
          <div className="text-3xl font-black tracking-widest text-red-600 -rotate-25 whitespace-nowrap uppercase font-mono">
            PROCAL FREE TRIAL — NOT FOR CONSTRUCTION
          </div>
          <div className="text-3xl font-black tracking-widest text-red-600 -rotate-25 whitespace-nowrap uppercase font-mono">
            EVALUATION ONLY — NOT FOR CONSTRUCTION
          </div>
        </div>
      )}
      {isPrintingAll && (
        <div id="print-sld-complete-package" className="hidden print:block bg-white text-black p-0 font-sans">
          <div className="h-[180mm] max-h-[180mm] overflow-hidden flex flex-col justify-between box-border">
            <div>
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
                    EXECUTIVE ELECTRICAL ENGINEERING & SLD PACKAGE
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Prepared in accordance with IEC 60364 & BS 7671 Electrical Regulations
                  </p>
                </div>
                <div className="text-right text-xs space-y-0.5 font-mono text-slate-300">
                  <div className="font-bold text-sm text-amber-400">ProCal Engineering Suite</div>
                  <div>Report Ref: <span className="font-semibold text-white">PRJ-{project.id.slice(-6).toUpperCase()}</span></div>
                  <div>Date: <span className="font-semibold text-white">{new Date().toLocaleDateString()}</span></div>
                </div>
              </div>

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

              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                1. System Electrical Calculations Summary
              </h2>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="border border-amber-200 rounded-xl p-2.5 text-center bg-amber-50/60">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">Total Max Demand</span>
                  <span className="text-base font-black text-amber-950">{projectMetrics.totalPower.toFixed(1)} kVA</span>
                  <span className="text-[10px] font-semibold text-amber-700 block mt-0.5">
                    {(projectMetrics.totalPowerKw ?? 0).toFixed(1)} kW (PF {project.powerFactor || 0.85})
                  </span>
                </div>
                <div className="border border-sky-200 rounded-xl p-2.5 text-center bg-sky-50/60">
                  <span className="text-[10px] font-bold uppercase text-sky-800 block">Calculated Current</span>
                  <span className="text-base font-black text-sky-950">{projectMetrics.totalCurrent.toFixed(1)} A</span>
                </div>
                <div className="border border-emerald-200 rounded-xl p-2.5 text-center bg-emerald-50/60">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">System Voltage</span>
                  <span className="text-base font-black text-emerald-950">{project.voltage}V 3-Phase</span>
                </div>
                <div className="border border-purple-200 rounded-xl p-2.5 text-center bg-purple-50/60">
                  <span className="text-[10px] font-bold uppercase text-purple-800 block">Utility Transformer</span>
                  <span className="text-base font-black text-purple-950">1000 kVA ({project.voltage}V)</span>
                </div>
              </div>

              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                2. Project Distribution Hierarchy & Infrastructure
              </h2>
              <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden mb-4">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-2 border-r border-slate-800">Building / Structure</th>
                    <th className="p-2 border-r border-slate-800">Floors</th>
                    <th className="p-2 border-r border-slate-800">Distribution Panels (SDB/DB)</th>
                    <th className="p-2 border-r border-slate-800">Feeder Cable Specs</th>
                    <th className="p-2 text-right">Max Demand (kVA / kW / Amps)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {project.buildings?.map((bldg, idx) => {
                    const bldgPf = project.powerFactor || 0.85;
                    const bldgCurrent = bldg.floorDesigns?.reduce(
                      (s, fd) => s + (fd.items?.reduce((is, i) => is + (i.calculatedCurrent || 0), 0) || 0),
                      0
                    ) || 0;
                    const bldgPowerKw = (bldg.floorDesigns?.reduce(
                      (s, fd) => s + (fd.items?.reduce((is, i) => is + (i.calculatedMaxDemand || 0), 0) || 0),
                      0
                    ) || 0) + (bldg.buildingLoads ?? []).reduce((s, bl) => s + (bl.loadLibraryItem?.power ?? 0) * bl.quantity, 0);
                    const bldgKva = bldgPowerKw / bldgPf;

                    return (
                      <tr key={bldg.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                        <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{bldg.name}</td>
                        <td className="p-2 border-r border-slate-200">{bldg.floors} Floors</td>
                        <td className="p-2 border-r border-slate-200">{bldg.floorDesigns?.length || 0} Sub-Panels</td>
                        <td className="p-2 border-r border-slate-200 font-mono text-[10px] text-slate-700">
                          Rising Main Busbar Trunking (800A)
                        </td>
                        <td className="p-2 font-bold text-slate-900 font-mono text-right">
                          {bldgKva.toFixed(1)} kVA{' '}
                          <span className="text-slate-600 font-normal text-[11px]">
                            ({bldgPowerKw.toFixed(1)} kW)
                          </span>{' '}
                          <span className="text-amber-700 font-mono text-[11px]">
                            [{bldgCurrent.toFixed(1)}A]
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h2 className="text-xs font-bold text-slate-900 uppercase mb-2 border-l-4 border-amber-500 pl-2.5">
                3. Single Line Diagram Drawings Index ({pages.length} Pages)
              </h2>
              <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-mono border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                {pages.map((p, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-slate-200/80 truncate pr-1">
                    <span className="font-bold text-amber-700 shrink-0 mr-1.5">Drawing {String(idx + 1).padStart(2, '0')}:</span>
                    <span className="truncate text-slate-800">{p.floors || p.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-500 flex justify-between font-mono mt-4">
              <div>ProCal Engineering System — Single Line Diagram Generator</div>
              <div>Page 1 of {pages.length + 1}</div>
            </div>
          </div>

          {pages.map((page, idx) => (
            <div
              key={idx}
              style={{ pageBreakBefore: 'always', breakBefore: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' }}
              className="pt-2 w-full max-w-full box-border max-h-[180mm] overflow-hidden"
            >
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-2 font-sans text-slate-900 w-full max-w-full box-border">
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-black text-slate-900 uppercase tracking-tight truncate">
                    {project.name}
                  </h1>
                  <p className="text-xs font-bold text-amber-700 truncate mt-0.5">
                    SINGLE LINE DIAGRAM — {page.floors || page.title}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-800 font-mono shrink-0 leading-tight space-y-0.5 pr-1 bg-slate-100/80 border border-slate-200 rounded-lg px-2.5 py-1">
                  <div><span className="font-bold text-slate-900">{project.voltage}V 3-Phase</span> | <span className="font-bold text-slate-900">IEC 60364</span></div>
                  <div>Drawing: <span className="font-bold text-amber-700">{String(idx + 1).padStart(2, '0')} / {pages.length}</span></div>
                </div>
              </div>

              <div className="sld-canvas-wrapper w-full max-h-[150mm] overflow-hidden">
                <SchematexDiagram dsl={page.dsl} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
