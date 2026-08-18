"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Project } from "@/types";

export type PreferredManufacturer = "ABB" | "SCHNEIDER" | "EATON" | "SIEMENS" | "LEGRAND" | "ISKRA" | "MIXED";

interface ProjectContextType {
  selectedProjectId: string | null;
  selectedProject: Project | null;
  preferredManufacturer: PreferredManufacturer;
  hasCompletedOnboarding: boolean;
  selectProject: (id: string | null) => void;
  setManufacturer: (mfg: PreferredManufacturer) => void;
  completeOnboarding: () => void;
  refreshProject: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [preferredManufacturer, setPreferredManufacturer] = useState<PreferredManufacturer>("MIXED");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  // Load initial selection from localStorage
  useEffect(() => {
    const savedProjId = localStorage.getItem("selected_project_id");
    const savedMfg = localStorage.getItem("preferred_manufacturer") as PreferredManufacturer;
    const savedOnboarding = localStorage.getItem("has_completed_onboarding");

    if (savedProjId) setSelectedProjectId(savedProjId);
    if (savedMfg) setPreferredManufacturer(savedMfg);
    if (savedOnboarding === "true") setHasCompletedOnboarding(true);
  }, []);

  // Dedupe concurrent fetches for the same project: on first mount the context
  // fetch and a page's loadProject can both fire before either resolves, which
  // used to download the (large) project payload twice. Callers racing for the
  // same projectId now share one in-flight request; sequential calls (after the
  // map entry is cleared) always fetch fresh.
  const inflightFetches = useRef<Map<string, Promise<void>>>(new Map());

  const fetchProjectDetails = useCallback(async (projectId: string) => {
    const existing = inflightFetches.current.get(projectId);
    if (existing) return existing;

    const promise = (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedProject(data);
          if (data.preferredManufacturer) {
            setPreferredManufacturer(data.preferredManufacturer);
            localStorage.setItem("preferred_manufacturer", data.preferredManufacturer);
          }
        } else {
          setSelectedProject(null);
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        setSelectedProject(null);
      } finally {
        setLoading(false);
      }
    })();

    inflightFetches.current.set(projectId, promise);
    try {
      await promise;
    } finally {
      if (inflightFetches.current.get(projectId) === promise) {
        inflightFetches.current.delete(projectId);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, fetchProjectDetails]);

  const selectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      localStorage.setItem("selected_project_id", id);
    } else {
      localStorage.removeItem("selected_project_id");
    }
  }, []);

  const setManufacturer = useCallback((mfg: PreferredManufacturer) => {
    setPreferredManufacturer(mfg);
    localStorage.setItem("preferred_manufacturer", mfg);
    // Optionally update in DB
    if (selectedProjectId) {
      fetch(`/api/projects/${selectedProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredManufacturer: mfg }),
      });
    }
  }, [selectedProjectId]);

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
    localStorage.setItem("has_completed_onboarding", "true");
  }, []);

  const refreshProject = useCallback(async () => {
    if (selectedProjectId) {
      await fetchProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId, fetchProjectDetails]);

  return (
    <ProjectContext.Provider
      value={{
        selectedProjectId,
        selectedProject,
        preferredManufacturer,
        hasCompletedOnboarding,
        selectProject,
        setManufacturer,
        completeOnboarding,
        refreshProject,
        loading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
