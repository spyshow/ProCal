// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ProjectSettingsTab } from "./ProjectSettingsTab";

const mutateProject = vi.fn();
const onProjectUpdated = vi.fn();

const mockProject = {
  id: "proj-123",
  name: "Al-Noor Tower",
  client: "Emaar",
  consultant: "Dar Al-Handasah",
  contractor: "Arabtec",
  location: "Dubai",
  engineer: "Alice",
  calculationStandard: "IEC",
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  maxDemandFactor: 0.8,
  maxVoltageDropLighting: 3.0,
  maxVoltageDropPower: 5.0,
  preferredManufacturer: "Schneider",
  country: "UAE",
  logoUrl: "",
  notes: "Test project notes",
};

const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    storage[key] = String(val);
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    for (const key in storage) {
      delete storage[key];
    }
  }),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    selectedProjectId: "proj-123",
    selectedProject: mockProject,
    mutateProject,
    isQA: false,
    canEdit: () => true,
    currentMemberRole: "ADMIN",
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("ProjectSettingsTab - Voltage Drop & Standards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    fetchMock.mockImplementation(async (url: string) => {
      return new Response(JSON.stringify(mockProject), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  it("renders subtabs and defaults to General Specifications", () => {
    render(<ProjectSettingsTab projectId="proj-123" onProjectUpdated={onProjectUpdated} />);

    expect(screen.getByRole("button", { name: "General Specifications" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /voltage drop & standards/i })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /company & branding/i })).toBeInTheDocument();

    // Verify General Specs fields
    expect(screen.getByDisplayValue("Al-Noor Tower")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Emaar")).toBeInTheDocument();

    // Notice banner linking to Voltage Drop & Standards
    expect(screen.getByText(/Looking for Voltage Drop Limits/i)).toBeInTheDocument();
  });

  it("switches to Voltage Drop & Standards tab when clicking notice banner link", () => {
    render(<ProjectSettingsTab projectId="proj-123" onProjectUpdated={onProjectUpdated} />);

    // Click banner link ("Voltage Drop & Standards →")
    const bannerLinks = screen.getAllByRole("button", { name: /voltage drop & standards/i });
    expect(bannerLinks.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(bannerLinks[1]);

    expect(screen.getByRole("heading", { name: /voltage drop compliance limits/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /electrical system parameters & standards/i })).toBeInTheDocument();
  });

  it("activates Voltage Drop & Standards subtab when initialSubtab is 'engineering' or 'standards'", () => {
    const { unmount } = render(
      <ProjectSettingsTab projectId="proj-123" initialSubtab="engineering" onProjectUpdated={onProjectUpdated} />
    );
    expect(screen.getByRole("heading", { name: /voltage drop compliance limits/i })).toBeInTheDocument();
    unmount();

    render(
      <ProjectSettingsTab projectId="proj-123" initialSubtab="standards" onProjectUpdated={onProjectUpdated} />
    );
    expect(screen.getByRole("heading", { name: /voltage drop compliance limits/i })).toBeInTheDocument();
  });

  it("displays current project limits, system parameters, and regional jurisdiction", () => {
    render(
      <ProjectSettingsTab projectId="proj-123" initialSubtab="engineering" onProjectUpdated={onProjectUpdated} />
    );

    // Limits
    const lightingInputs = screen.getAllByDisplayValue("3");
    expect(lightingInputs.length).toBeGreaterThanOrEqual(1);

    const powerInputs = screen.getAllByDisplayValue("5");
    expect(powerInputs.length).toBeGreaterThanOrEqual(1);

    // Standard & Parameters
    expect(screen.getByDisplayValue("400")).toBeInTheDocument(); // Voltage
    expect(screen.getByDisplayValue("50")).toBeInTheDocument(); // Frequency
    expect(screen.getByDisplayValue("0.85")).toBeInTheDocument(); // Power Factor
    expect(screen.getByDisplayValue("0.8")).toBeInTheDocument(); // Demand Factor

    // Country
    expect(screen.getByDisplayValue("UAE")).toBeInTheDocument();

    // Room Power Densities section
    expect(screen.getByRole("heading", { name: /room power densities/i })).toBeInTheDocument();

    // AC Sizing section
    expect(screen.getByRole("heading", { name: /ac sizing rules/i })).toBeInTheDocument();
  });

  it("edits and saves voltage drop limits and electrical parameters to project DB and localStorage", async () => {
    render(
      <ProjectSettingsTab projectId="proj-123" initialSubtab="engineering" onProjectUpdated={onProjectUpdated} />
    );

    const lightingInput = screen.getAllByDisplayValue("3")[0];
    const powerInput = screen.getAllByDisplayValue("5")[0];

    fireEvent.change(lightingInput, { target: { value: "2.5" } });
    fireEvent.change(powerInput, { target: { value: "4.0" } });

    fetchMock.mockImplementationOnce(async (url: string, opts?: RequestInit) => {
      expect(url).toBe("/api/projects/proj-123");
      expect(opts?.method).toBe("PUT");
      const body = JSON.parse(opts?.body as string);
      expect(body.maxVoltageDropLighting).toBe(2.5);
      expect(body.maxVoltageDropPower).toBe(4);
      expect(body.calculationStandard).toBe("IEC");
      expect(body.voltage).toBe(400);
      expect(body.frequency).toBe(50);
      return new Response(JSON.stringify({ ...mockProject, maxVoltageDropLighting: 2.5, maxVoltageDropPower: 4.0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const saveButtons = screen.getAllByRole("button", { name: /save voltage drop & standards/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(mutateProject).toHaveBeenCalled();
      expect(onProjectUpdated).toHaveBeenCalled();
    });

    // Check localStorage sync
    const savedLocal = JSON.parse(mockLocalStorage.getItem("procal-vd-limits") || "{}");
    expect(savedLocal).toEqual({ lighting: 2.5, power: 4.0 });

    // Success banner
    expect(await screen.findByText(/saved to project database/i)).toBeInTheDocument();
  });

  it("resets voltage drop limits back to defaults when clicking reset", () => {
    render(
      <ProjectSettingsTab projectId="proj-123" initialSubtab="engineering" onProjectUpdated={onProjectUpdated} />
    );

    const lightingInput = screen.getAllByDisplayValue("3")[0];
    fireEvent.change(lightingInput, { target: { value: "1.8" } });
    expect(screen.getByDisplayValue("1.8")).toBeInTheDocument();

    const resetButtons = screen.getAllByRole("button", { name: /reset to defaults/i });
    fireEvent.click(resetButtons[0]);

    // Should reset to 3.0
    expect(screen.queryByDisplayValue("1.8")).not.toBeInTheDocument();
  });
});
