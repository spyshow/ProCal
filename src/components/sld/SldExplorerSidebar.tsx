'use client';

import { useTranslation } from '@/i18n';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Search,
  Layers,
  Zap,
  Cpu,
  Plug,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { ComponentProperty, HierarchyItem } from './sld-types';

export interface SldExplorerSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  dynamicTree: HierarchyItem[];
  explorerSearch: string;
  setExplorerSearch: (v: string) => void;
  expandedNodes: Record<string, boolean>;
  toggleNode: (key: string) => void;
  selectedComponent: ComponentProperty | null;
  handleSelectNode: (data: ComponentProperty, floorNum?: number) => void;
  getStatus: (id: string) => 'Closed' | 'Open' | 'Tripped';
}

export function SldExplorerSidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  dynamicTree,
  explorerSearch,
  setExplorerSearch,
  expandedNodes,
  toggleNode,
  selectedComponent,
  handleSelectNode,
  getStatus,
}: SldExplorerSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      data-tour="sld-tree"
      className={`${
        isSidebarCollapsed ? 'w-12' : 'w-64 xl:w-72'
      } border-r border-[var(--border-color)] bg-[var(--card-bg-subtle)] flex flex-col shrink-0 transition-all duration-200 print:hidden relative`}
    >
      {isSidebarCollapsed ? (
        <div className="flex flex-col items-center py-3 gap-4">
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] text-orange-400 hover:text-[var(--foreground-color)] hover:border-orange-500/50 transition-colors shadow-xs cursor-pointer"
            title="Expand Project Explorer Menu"
          >
            <PanelLeftOpen size={16} />
          </button>

          <div className="w-6 h-px bg-[var(--border-color)] my-1" />

          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-orange-400 hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
            title="Project Explorer Tree"
          >
            <FolderTree size={16} />
          </button>

          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-orange-400 hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
            title="Search Circuits"
          >
            <Search size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground-color)]">
              <FolderTree size={14} className="text-orange-400" />
              <span>{t('sld.explorerTree', 'Project Explorer Tree')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{dynamicTree.length} {t('sld.nodes', 'Nodes')}</span>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--foreground-color)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
                title="Collapse Explorer Menu"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          <div className="p-2.5 border-b border-[var(--border-color)]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                aria-label={t('sld.searchPlaceholder', 'Search circuits or panels…')}
                placeholder={t('sld.searchPlaceholder', 'Search circuits or panels…')}
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg ps-8 pe-3 py-1 text-xs text-[var(--foreground-color)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs no-scrollbar">
            {dynamicTree
              .filter((item) =>
                explorerSearch ? item.name.toLowerCase().includes(explorerSearch.toLowerCase()) : true
              )
              .map((item) => {
                const isExpanded = expandedNodes[item.id] ?? true;
                const isSelected = selectedComponent?.id === item.data.id;

                return (
                  <div key={item.id}>
                    <button
                      onClick={() => {
                        toggleNode(item.id);
                        handleSelectNode(item.data, item.floorNumber);
                      }}
                      className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40 font-medium'
                          : 'hover:bg-[var(--card-bg)] text-[var(--foreground-color)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        {item.children && item.children.length > 0 ? (
                          isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          )
                        ) : (
                          <div className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {item.icon === 'zap' && <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        {item.icon === 'cpu' && <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {item.icon === 'layers' && <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        {item.icon === 'plug' && <Plug className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </button>

                    {item.children && isExpanded && (
                      <div className="pl-4 space-y-0.5 mt-0.5 border-l border-[var(--border-color)] ml-2.5">
                        {item.children.map((child: HierarchyItem) => {
                          const isChildSelected = selectedComponent?.id === child.data.id;
                          const childStatus = getStatus(child.data.id);
                          return (
                            <div key={child.id}>
                              <button
                                onClick={() => handleSelectNode(child.data, child.floorNumber)}
                                className={`w-full flex items-center justify-between py-1 px-2 rounded text-left transition-colors text-xs cursor-pointer ${
                                  isChildSelected
                                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/40 font-medium'
                                    : 'hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
                                }`}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span className="truncate">{child.name}</span>
                                </span>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    childStatus === 'Closed' ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                />
                              </button>

                              {child.children && (
                                <div className="pl-3 space-y-0.5 mt-0.5 border-l border-[var(--border-color)]/70 ml-2">
                                  {child.children.map((sub: HierarchyItem) => {
                                    const isSubSelected = selectedComponent?.id === sub.data.id;
                                    return (
                                      <button
                                        key={sub.id}
                                        onClick={() => handleSelectNode(sub.data, sub.floorNumber)}
                                        className={`w-full flex items-center justify-between py-0.5 px-1.5 rounded text-[11px] text-left transition-colors cursor-pointer ${
                                          isSubSelected
                                            ? 'bg-orange-500/20 text-orange-400 font-medium'
                                            : 'hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground-color)]'
                                        }`}
                                      >
                                        <span className="truncate flex items-center gap-1">
                                          <Plug className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                          <span className="truncate">{sub.name}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </aside>
  );
}
