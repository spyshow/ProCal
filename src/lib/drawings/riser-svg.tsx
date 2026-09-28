import React from 'react';
import { formatCableSizeFor } from '@/lib/calculations/cables';
import {
  RISER_BAND_COLOR,
  type RiserModel,
  type RiserSheet,
  type RiserLabels,
  DEFAULT_RISER_LABELS,
} from './riser-model';

/**
 * Presentational riser SVG.
 *
 * Deliberately free of React hooks, i18next and CSS custom properties so the
 * exact same component renders on the interactive page and through
 * `renderToStaticMarkup` for the server-side print path (Task 4 Step 3).
 * All colours come from the `theme` prop; all text from the `labels` prop.
 *
 * Extracted from `src/app/(app)/riser/page.tsx`.
 */

export interface RiserTheme {
  cardBg: string;
  cardBgSubtle: string;
  border: string;
  foreground: string;
  muted: string;
}

/** Matches the app's CSS variables so the on-screen page is pixel-identical. */
export const SCREEN_RISER_THEME: RiserTheme = {
  cardBg: 'var(--card-bg)',
  cardBgSubtle: 'var(--card-bg-subtle)',
  border: 'var(--border-color)',
  foreground: 'var(--foreground-color)',
  muted: 'var(--text-muted)',
};

/** Concrete hex values — CSS variables do not resolve inside headless Chromium. */
export const PRINT_RISER_THEME: RiserTheme = {
  cardBg: '#ffffff',
  cardBgSubtle: '#f8fafc',
  border: '#cbd5e1',
  foreground: '#0f172a',
  muted: '#64748b',
};

const ORANGE = '#f97316';
const BLUE = '#3b82f6';
const DASH = '—';

/** Dark fill used behind a ΔV / demand figure on a coloured band. */
const BAND_FILL: Record<string, string> = {
  ok: '#1e3a5f',
  warning: '#713f12',
  danger: '#7f1d1d',
  nodata: '#f8fafc',
};
const BAND_TEXT: Record<string, string> = {
  ok: '#93c5fd',
  warning: '#fde047',
  danger: '#fca5a5',
  nodata: '#64748b',
};

export interface RiserSvgProps {
  model: RiserModel;
  /**
   * Render one paginated sheet instead of the whole drawing. Omit for the
   * on-screen page, which shows everything at once.
   */
  sheet?: RiserSheet;
  theme?: RiserTheme;
  labels?: Partial<RiserLabels>;
  /** Optional wrapper className (screen mode only; ignored by the print path). */
  className?: string;
  idPrefix?: string;
  /** React 19 passes `ref` as a plain prop; the page uses it for SVG export. */
  ref?: React.Ref<SVGSVGElement>;
}

export function RiserSvg({
  model,
  sheet,
  theme = SCREEN_RISER_THEME,
  labels: labelOverrides,
  className,
  idPrefix = 'riser',
  ref,
}: RiserSvgProps) {
  const L: RiserLabels = { ...DEFAULT_RISER_LABELS, ...labelOverrides };
  const { layout, project, building, totalVdLimit, mdb, transformer } = model;
  const { svgWidth, busX, itemSpacing, headerHeight, footerHeight, mdbHeight } =
    layout;

  // A sheet is a paginated slice; without one we draw the whole model.
  const floors = sheet ? sheet.floors : model.floors;
  const svgHeight = sheet ? sheet.svgHeight : layout.svgHeight;
  const showSupplyBlock = sheet ? sheet.showSupplyBlock : true;
  const legendY = svgHeight - 10;
  const busBottomY = showSupplyBlock
    ? svgHeight - footerHeight - mdbHeight - 40
    : svgHeight - 24;

  const standard = project.calculationStandard;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth}
      height={svgHeight}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`${L.title} — ${building.name}`}
    >
      <defs>
        <pattern id={`${idPrefix}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme.border} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={svgWidth} height={svgHeight} fill={`url(#${idPrefix}-grid)`} />

      {/* Title block */}
      <text x={busX} y="30" textAnchor="middle" fill={theme.foreground} fontSize="16" fontWeight="700">
        {L.title} {DASH} {building.name}
      </text>
      <text x={busX} y="50" textAnchor="middle" fill={theme.muted} fontSize="11">
        {project.voltage}V · {project.powerFactor} PF · {building.earthingSystem || '—'} ·{' '}
        {model.floors.length} {L.floors} · {standard || 'IEC'}
        {sheet && sheet.total > 1
          ? ` · sheet ${sheet.index}/${sheet.total} (${L.floor} ${sheet.firstFloorNumber}–${sheet.lastFloorNumber})`
          : ''}
      </text>

      {/* Supply feeder cable + transformer + MDB: first sheet only */}
      {showSupplyBlock && (
        <>
          <line
            x1={busX}
            y1={busBottomY - 107}
            x2={busX}
            y2={busBottomY}
            stroke={ORANGE}
            strokeWidth="2.5"
          />
          <circle cx={busX} cy={busBottomY} r="3" fill={ORANGE} />
          <text
            x={busX + 8}
            y={(busBottomY - 107 + busBottomY) / 2 + 3}
            fill={theme.muted}
            fontSize="8"
            fontFamily="monospace"
          >
            {L.lvIncomer}
          </text>

          <g transform={`translate(${busX}, ${svgHeight - 125})`}>
            <circle cx="-14" cy="0" r="22" fill="none" stroke={ORANGE} strokeWidth="2" />
            <circle cx="14" cy="0" r="22" fill="none" stroke={ORANGE} strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fill={ORANGE} fontSize="10.5" fontWeight="600">
              {L.transformer}
            </text>
            <text x="0" y="34" textAnchor="middle" fill={theme.foreground} fontSize="11" fontWeight="700">
              {transformer.kva} kVA
            </text>
            <text x="0" y="48" textAnchor="middle" fill={theme.muted} fontSize="9">
              {project.voltage}V · {transformer.impedance}% Z
            </text>
          </g>

          <g transform={`translate(${busX - 100}, ${busBottomY - mdbHeight})`}>
            <rect x="0" y="0" width="200" height={mdbHeight} fill={theme.cardBg} stroke={ORANGE} strokeWidth="2" rx="4" />
            <text x="100" y="20" textAnchor="middle" fill={ORANGE} fontSize="12" fontWeight="700">
              {L.mdb}
            </text>
            <text x="100" y="38" textAnchor="middle" fill={theme.foreground} fontSize="10" fontWeight="600">
              {mdb.mainBreakerIn}A {mdb.settingsCategory} ·{' '}
              {model.buildingTotal.demandKva.toFixed(1)} kVA
            </text>
            <text x="100" y="54" textAnchor="middle" fill={theme.muted} fontSize="9">
              {mdb.mainIncomerCurrent.toFixed(0)}A · {mdb.mainCableLabel}
            </text>
          </g>
        </>
      )}

      {/* Main bus — runs to the supply block on sheet 1, to the foot of the
          drawing on continuation sheets. */}
      <line
        x1={busX}
        y1={busBottomY}
        x2={busX}
        y2={headerHeight}
        stroke={ORANGE}
        strokeWidth="3"
      />
      <text x={busX} y={headerHeight - 10} textAnchor="middle" fill={ORANGE} fontSize="10" fontWeight="600">
        {L.mainBus} — {project.voltage}V
      </text>

      {/* Floors */}
      {floors.map((fd, i) => {
        const cy = fd.cy;
        const lineColor = RISER_BAND_COLOR[fd.band];
        return (
          <g key={fd.id}>
            <line x1="60" y1={cy} x2={svgWidth - 60} y2={cy} stroke={theme.border} strokeWidth="1" strokeDasharray="4" />

            <rect x="60" y={cy - 14} width="70" height="28" fill={theme.cardBg} stroke={theme.border} strokeWidth="1" rx="3" />
            <text x="95" y={cy + 4} textAnchor="middle" fill={ORANGE} fontSize="10" fontWeight="700">
              {L.floor} {fd.floorNumber}
            </text>

            {/* Total ΔV indicator (transformer → furthest load) */}
            <g transform={`translate(200, ${cy - 12})`}>
              <rect
                x="0"
                y="0"
                width="100"
                height="24"
                fill={BAND_FILL[fd.band]}
                stroke={lineColor}
                strokeWidth="1"
                rx="3"
              />
              <text x="50" y="10" textAnchor="middle" fill={BAND_TEXT[fd.band]} fontSize="8" fontWeight="600" fontFamily="monospace">
                {fd.totalNoData ? 'ΔV —' : `ΔV ${fd.totalVdPercent.toFixed(2)}%`}
              </text>
              <text x="50" y="20" textAnchor="middle" fill={BAND_TEXT[fd.band]} fontSize="7" fontFamily="monospace">
                {fd.totalNoData ? L.noData : `${fd.actualVoltage.toFixed(1)}V`}
              </text>
            </g>

            <circle cx={busX} cy={cy} r="4" fill={ORANGE} />

            {/* Orange riser: MDB bus → SDB, sub-panel floors only */}
            {fd.hasFloorSubPanels && <line x1={busX} y1={cy} x2={570} y2={cy} stroke={ORANGE} strokeWidth="2" />}

            <text
              x={fd.hasFloorSubPanels ? 515 : (busX + 730) / 2}
              y={cy - 8}
              textAnchor="middle"
              fill={theme.muted}
              fontSize="7.5"
              fontFamily="monospace"
            >
              {fd.hasRiser
                ? fd.riserNoData
                  ? L.noData
                  : `${fd.riserCableSize ? formatCableSizeFor(fd.riserCableSize, standard) : '—'} ${fd.riserCableInsulation || 'XLPE'}${fd.riserCableMaterial === 'aluminum' ? ' Al' : ''} · ${fd.riserCableLength?.toFixed(0) ?? '—'}m`
                : `${fd.items.length} ${L.circuits}`}
            </text>

            {/* SDB block on the riser */}
            {fd.hasFloorSubPanels && (
              <g transform={`translate(570, ${cy - 20})`}>
                <rect x="0" y="0" width="130" height="40" fill={theme.cardBg} stroke={theme.border} strokeWidth="1" rx="3" />
                <text x="65" y="11" textAnchor="middle" fill={theme.foreground} fontSize="9" fontWeight="600">
                  {L.subPanelPrefix}-{fd.floorNumber}
                </text>
                <text x="65" y="22" textAnchor="middle" fill={theme.muted} fontSize="7">
                  {fd.floorDemand.toFixed(1)}kW · {fd.floorKva.toFixed(1)}kVA · DF{fd.diversityPct.toFixed(0)}%
                </text>
                <text x="65" y="33" textAnchor="middle" fill={theme.muted} fontSize="7">
                  {fd.riserNoData
                    ? `${L.noData} · ${fd.floorCurrent.toFixed(0)}A`
                    : `${formatCableSizeFor(fd.riserCableSize, standard)} · L=${fd.riserCableLength?.toFixed(0)}m · ${fd.floorCurrent.toFixed(0)}A`}
                </text>
              </g>
            )}

            {/* Downstream feeder rail: board → rail → circuits */}
            {fd.circuits.length > 0 &&
              (() => {
                const railX = 730;
                const boardEdgeX = fd.hasFloorSubPanels ? 700 : busX;
                const N = fd.circuits.length;
                const firstCY = cy + (0 - (N - 1) / 2) * itemSpacing;
                const lastCY = cy + (N - 1 - (N - 1) / 2) * itemSpacing;
                const aptLeft = 740;
                return (
                  <>
                    <line x1={boardEdgeX} y1={cy} x2={railX} y2={cy} stroke={BLUE} strokeWidth="2" />
                    {N > 1 && <line x1={railX} y1={firstCY} x2={railX} y2={lastCY} stroke={BLUE} strokeWidth="2" />}
                    <text x={railX} y={firstCY - 8} textAnchor="middle" fill={ORANGE} fontSize="8.5" fontWeight="700">
                      W{i + 1}
                    </text>
                    {fd.circuits.map((c, ci) => {
                      const nodeCY = cy + (ci - (N - 1) / 2) * itemSpacing;
                      return (
                        <g key={c.id || ci}>
                          <line x1={railX} y1={nodeCY} x2={aptLeft} y2={nodeCY} stroke={BLUE} strokeWidth="1.5" />
                          <rect x={aptLeft} y={nodeCY - 11} width="115" height="22" fill={theme.cardBg} stroke={BLUE} strokeWidth="1" rx="3" />
                          <text x={aptLeft + 57.5} y={nodeCY - 1} textAnchor="middle" fill={theme.foreground} fontSize="7.5" fontWeight="600">
                            {c.name}
                          </text>
                          <text x={aptLeft + 57.5} y={nodeCY + 8} textAnchor="middle" fill={theme.muted} fontSize="6.5">
                            {c.cableLabel} · {c.demandKw.toFixed(1)}kW
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(60, ${legendY})`}>
        <text x="0" y="0" fill={theme.foreground} fontSize="9" fontWeight="600">
          {L.legend} (total ΔV, transformer→furthest load):
        </text>
        <line x1="310" y1="0" x2="330" y2="0" stroke={RISER_BAND_COLOR.ok} strokeWidth="2" />
        <text x="335" y="3" fill={theme.muted} fontSize="8">
          {L.normal} (&lt;{(totalVdLimit * 0.8).toFixed(1)}%)
        </text>
        <line x1="415" y1="0" x2="435" y2="0" stroke={RISER_BAND_COLOR.warning} strokeWidth="2" />
        <text x="440" y="3" fill={theme.muted} fontSize="8">
          {L.warning}
        </text>
        <line x1="515" y1="0" x2="535" y2="0" stroke={RISER_BAND_COLOR.danger} strokeWidth="2" />
        <text x="540" y="3" fill={theme.muted} fontSize="8">
          {L.danger} (&gt;{totalVdLimit}%)
        </text>
        <line x1="620" y1="0" x2="640" y2="0" stroke={RISER_BAND_COLOR.nodata} strokeWidth="2" strokeDasharray="3" />
        <text x="645" y="3" fill={theme.muted} fontSize="8">
          {L.noData}
        </text>
        <text x="710" y="3" fill={theme.muted} fontSize="8">
          {L.iecNote(totalVdLimit)}
        </text>
      </g>
    </svg>
  );
}

export default RiserSvg;
