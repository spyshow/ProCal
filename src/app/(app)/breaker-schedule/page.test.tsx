// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockMutateProject = vi.fn();
const mockRefreshProject = vi.fn();
let mockProject: any = null;

vi.mock('@/context/ProjectContext', () => ({
  useProject: () => ({
    selectedProjectId: mockProject?.id ?? 'proj-1',
    selectedProject: mockProject,
    loading: false,
    preferredManufacturer: 'SCHNEIDER',
    refreshProject: mockRefreshProject,
    mutateProject: mockMutateProject,
    canView: () => true,
    canEdit: () => true,
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_k: string, d?: string) => d || _k,
  }),
}));

vi.mock('@/components/layout/WorkflowStepper', () => ({
  default: () => <div data-testid="stepper" />,
}));
vi.mock('@/components/ReadOnlyBanner', () => ({
  ReadOnlyBanner: () => null,
}));
vi.mock('@/components/QAReviewDrawer', () => ({
  QAReviewDrawer: () => null,
}));
vi.mock('@/components/coordination/TccPlotModal', () => ({
  default: () => null,
}));
vi.mock('@/components/breaker/BreakerSizingGuideModal', () => ({
  BreakerSizingGuideModal: () => null,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('BreakerSchedulePage - Default Breaker Families Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
      defaultAcbFamilyId: null,
      defaultMccbFamilyId: null,
      defaultMcbFamilyId: null,
      preferredManufacturer: 'SCHNEIDER',
      buildings: [
        {
          id: 'bldg-1',
          name: 'Main Building',
          floorDesigns: [],
          buildingLoads: [],
        },
      ],
    };

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/equipment')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (urlStr.includes('/api/breaker-families')) {
        return new Response(
          JSON.stringify([
            { id: 'fam-acb-1', manufacturer: 'Schneider', category: 'ACB', name: 'MasterPact MTZ' },
            { id: 'fam-mcb-1', manufacturer: 'Schneider', category: 'MCB', name: 'Acti9 iC60' },
          ]),
          { status: 200 }
        );
      }
      if (urlStr.includes('/api/breaker-settings')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (urlStr.includes('/api/projects/proj-1') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            ...mockProject,
            ...body,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  async function renderPage() {
    const Page = (await import('./page')).default;
    return render(<Page />);
  }

  it('calls mutateProject when changing default breaker family so context updates immediately', async () => {
    mockMutateProject.mockImplementation((updater) => {
      mockProject = updater(mockProject);
    });

    const { unmount } = await renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/family \/ series/i, { selector: '#default-family-ACB' })).toBeInTheDocument();
    });

    const acbSelect = screen.getByLabelText(/family \/ series/i, { selector: '#default-family-ACB' }) as HTMLSelectElement;
    expect(acbSelect.value).toBe('');

    fireEvent.change(acbSelect, { target: { value: 'fam-acb-1' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/proj-1',
        expect.objectContaining({
          method: 'PUT',
          keepalive: true,
          body: expect.stringContaining('"defaultAcbFamilyId":"fam-acb-1"'),
        })
      );
    });

    expect(mockMutateProject).toHaveBeenCalled();
    expect(mockProject.defaultAcbFamilyId).toBe('fam-acb-1');

    // Simulate navigating away and coming back (page unmount + remount)
    unmount();

    // Now renderPage again with the updated context
    const { unmount: unmount2 } = await renderPage();

    await waitFor(() => {
      const remountedAcbSelect = screen.getByLabelText(/family \/ series/i, { selector: '#default-family-ACB' }) as HTMLSelectElement;
      expect(remountedAcbSelect.value).toBe('fam-acb-1');
    });

    unmount2();
  });

  it('allows switching back to preferred manufacturer fallback', async () => {
    mockProject.defaultAcbFamilyId = 'fam-acb-1';
    mockMutateProject.mockImplementation((updater) => {
      mockProject = updater(mockProject);
    });

    await renderPage();

    await waitFor(() => {
      const acbSelect = screen.getByLabelText(/family \/ series/i, { selector: '#default-family-ACB' }) as HTMLSelectElement;
      expect(acbSelect.value).toBe('fam-acb-1');
    });

    const acbSelect = screen.getByLabelText(/family \/ series/i, { selector: '#default-family-ACB' });
    fireEvent.change(acbSelect, { target: { value: '' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/proj-1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"defaultAcbFamilyId":null'),
        })
      );
    });

    expect(mockProject.defaultAcbFamilyId).toBeNull();
  });
});
