// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();
let mockSelectedProjectId: string | null = "proj-123";

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
    selectedProjectId: mockSelectedProjectId,
  }),
}));

describe("SettingsPage - Account Settings and Standards Redirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedProjectId = "proj-123";
    window.history.pushState({}, "", "/settings");
  });

  async function renderSettingsPage() {
    const SettingsPage = (await import("./page")).default;
    return render(<SettingsPage />);
  }

  it("renders only personal account tabs and does NOT show Voltage Drop & Standards tab", async () => {
    await renderSettingsPage();

    // Verify personal tabs are present
    expect(screen.getByRole("button", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /language/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /account & security/i })).toBeInTheDocument();

    // Voltage Drop & Standards tab should NOT be on the account settings page
    expect(screen.queryByRole("button", { name: /voltage drop & standards/i })).not.toBeInTheDocument();
  });

  it("redirects ?tab=engineering to the active project settings page", async () => {
    window.history.pushState({}, "", "/settings?tab=engineering");
    await renderSettingsPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/projects/proj-123?tab=engineering");
    });
  });

  it("redirects ?tab=standards to the active project settings page", async () => {
    window.history.pushState({}, "", "/settings?tab=standards");
    await renderSettingsPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/projects/proj-123?tab=engineering");
    });
  });

  it("redirects ?tab=company to the active project company tab", async () => {
    window.history.pushState({}, "", "/settings?tab=company");
    await renderSettingsPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/projects/proj-123?tab=company");
    });
  });

  it("redirects ?tab=engineering to /projects if no project is active", async () => {
    mockSelectedProjectId = null;
    window.history.pushState({}, "", "/settings?tab=engineering");
    await renderSettingsPage();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/projects");
    });
  });

  it("allows switching between Appearance, Language, and Account tabs", async () => {
    await renderSettingsPage();

    const accountTab = screen.getByRole("button", { name: /account & security/i });
    fireEvent.click(accountTab);

    // Profile & Password settings should be visible
    expect(await screen.findByText(/profile details/i)).toBeInTheDocument();
    expect(screen.getByText(/change password/i)).toBeInTheDocument();
  });
});
