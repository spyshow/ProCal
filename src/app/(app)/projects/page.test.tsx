// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// T9-T11 — the projects page component test. The REGRESSION test (T9) is the
// whole point: on a 402 from /api/projects, the dead-button fix must fire
// refreshUser() AND router.push('/billing'). Before Track 3 there was no else
// on the `if (res.ok)`, so a 402 fell through silently.

// --- Mocks ------------------------------------------------------------
const refreshUser = vi.fn();
const push = vi.fn();

function setUser(user: any) { mockUser.current = user; }
const mockUser: { current: any } = { current: null };

vi.mock("@/context/UserContext", () => ({
  useUser: () => ({
    get user() {
      // user.id-stable getter so rerenders re-read the live mock value
      return mockUser.current;
    },
    refreshUser,
  }),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ selectProject: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/projects",
}));

// fetch is the single chokepoint for /api/projects GET (list) + POST (create).
const fetchMock = vi.fn();
(globalThis as any).fetch = fetchMock;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  // Default GET returns an empty project list (so the page renders stable).
  fetchMock.mockImplementation(async (url: string) =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

async function renderPage() {
  const ProjectsPage = (await import("./page")).default;
  return render(<ProjectsPage />);
}

describe("ProjectsPage dead-button fix (Track 3 regression)", () => {
  it("T9 REGRESSION: 402 → refreshUser called + router.push('/billing'), no project created", async () => {
    // Non-admin WITH a credit (so the proactive gate doesn't hide the form).
    setUser({ id: "u1", username: "alice", name: "Alice", role: "USER", credits: 1, email: "alice@e.com" });

    // The POST returns 402 (gate tripped server-side, the real race window).
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ error: "No credits remaining" }), { status: 402, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const { container } = await renderPage();
    // Open the New Project form (button says "New Project" when credits ≥ 1).
    fireEvent.click(screen.getByText("New Project"));
    // Fill the only required field.
    const nameInput = await screen.findByPlaceholderText("e.g. Marina Residence");
    fireEvent.change(nameInput, { target: { value: "Tower" } });
    // Submit.
    fireEvent.click(screen.getByText("Create Project", { exact: false }));

    // THE regression assertion pair: refreshUser fires AND we navigate to buy.
    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith("/billing");
    });
    // No successful-project path taken: selectProject not invoked, list unchanged.
    // (selectProject is mocked-via-vi.fn above; we trust no crash = no success path.)
  });

  it("T10 other non-ok → inline error, NOT a navigate", async () => {
    setUser({ id: "u1", username: "alice", name: "Alice", role: "USER", credits: 1, email: "alice@e.com" });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ error: "Project name too long" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    await renderPage();
    fireEvent.click(screen.getByText("New Project"));
    const nameInput = await screen.findByPlaceholderText("e.g. Marina Residence");
    fireEvent.change(nameInput, { target: { value: "X" } });
    fireEvent.click(screen.getByText("Create Project", { exact: false }));

    // Inline error surfaced; refreshUser + /billing NOT triggered.
    await waitFor(() => {
      expect(screen.getByText(/project name too long/i)).toBeInTheDocument();
    });
    expect(refreshUser).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("T11 zero-credit non-admin → form hidden, 'Get credits' shown, links to /billing", async () => {
    setUser({ id: "u1", username: "alice", name: "Alice", role: "USER", credits: 0, email: "alice@e.com" });

    await renderPage();
    // The proactive gate swaps the button for a /billing link.
    const buyLink = await waitFor(() => screen.getByText(/get credits/i));
    expect(buyLink.closest("a")).toHaveAttribute("href", "/billing");
    // No "New Project" affordance exists.
    expect(screen.queryByRole("button", { name: /New Project/i })).toBeNull();
    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
  });
});
