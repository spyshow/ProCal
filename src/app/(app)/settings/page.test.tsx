// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();
const mutateProject = vi.fn();
const selectProject = vi.fn();

const mockProject = {
  id: "proj-123",
  name: "Al-Noor Tower",
  client: "Emaar",
  location: "Dubai",
  calculationStandard: "IEC",
  voltage: 400,
  frequency: 50,
  powerFactor: 0.85,
  maxDemandFactor: 0.8,
  maxVoltageDropLighting: 3.0,
  maxVoltageDropPower: 5.0,
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/settings",
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "midnight",
    setTheme: vi.fn(),
    customAccent: "#f97316",
    setCustomAccent: vi.fn(),
    customBg: "#0f172a",
    setCustomBg: vi.fn(),
    customCardBg: "#1e293b",
    setCustomCardBg: vi.fn(),
  }),
}));

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    user: { id: "u1", name: "Engineer Alice", username: "alice", role: "ADMIN", email: "alice@example.com" },
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    selectedProjectId: "proj-123",
    selectedProject: mockProject,
    selectProject,
    mutateProject,
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("SettingsPage - Voltage Drop Limits & Engineering Standards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/projects")) {
        return new Response(JSON.stringify([mockProject]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  async function renderSettingsPage() {
    const SettingsPage = (await import("./page")).default;
    return render(<SettingsPage />);
  }

  it("renders the engineering tab and allows editing and saving DB voltage drop limits", async () => {
    await renderSettingsPage();

    // Find tab button for Voltage Drop & Standards
    const engineeringTabBtn = await screen.findByRole("button", {
      name: /voltage drop & standards/i,
    });
    expect(engineeringTabBtn).toBeInTheDocument();

    // Switch to engineering tab
    fireEvent.click(engineeringTabBtn);

    // Verify Voltage Drop Compliance Limits card appears
    expect(await screen.findByText(/voltage drop compliance limits/i)).toBeInTheDocument();

    // Verify project name badge
    expect(screen.getByText("Al-Noor Tower")).toBeInTheDocument();

    // Find inputs for lighting and power VD limits
    const lightingInput = screen.getByDisplayValue("3");
    const powerInput = screen.getByDisplayValue("5");
    expect(lightingInput).toBeInTheDocument();
    expect(powerInput).toBeInTheDocument();

    // Edit the values
    fireEvent.change(lightingInput, { target: { value: "2.5" } });
    fireEvent.change(powerInput, { target: { value: "4.0" } });

    // Mock PUT response
    fetchMock.mockImplementationOnce(async (url: string, opts?: RequestInit) => {
      expect(url).toBe("/api/projects/proj-123");
      expect(opts?.method).toBe("PUT");
      const parsedBody = JSON.parse(opts?.body as string);
      expect(parsedBody.maxVoltageDropLighting).toBe(2.5);
      expect(parsedBody.maxVoltageDropPower).toBe(4.0);
      return new Response(
        JSON.stringify({
          ...mockProject,
          maxVoltageDropLighting: 2.5,
          maxVoltageDropPower: 4.0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /save engineering limits/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutateProject).toHaveBeenCalled();
    });

    // Check localStorage sync
    const savedLocal = JSON.parse(mockLocalStorage.getItem("procal-vd-limits") || "{}");
    expect(savedLocal).toEqual({ lighting: 2.5, power: 4.0 });

    // Check success feedback message
    expect(await screen.findByText(/saved to project database/i)).toBeInTheDocument();
  });
});
