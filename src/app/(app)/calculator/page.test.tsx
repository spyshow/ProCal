// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockMutateProject = vi.fn();
const mockRefreshProject = vi.fn();
let mockProject: any = null;
let mockCanEdit = true;

vi.mock('@/context/ProjectContext', () => ({
  useProject: () => ({
    selectedProjectId: mockProject?.id ?? 'proj-1',
    selectedProject: mockProject,
    loading: false,
    refreshProject: mockRefreshProject,
    mutateProject: mockMutateProject,
    isQA: false,
    canView: () => true,
    canEdit: () => mockCanEdit,
    currentMemberRole: 'ENGINEER',
  }),
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (_k: string, d?: string) => d || _k,
    isRtl: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
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
vi.mock('@/components/MotionIcon', () => ({
  MotionIcon: () => null,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('CalculatorPage - Editable Load Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanEdit = true;
    mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      voltage: 400,
      frequency: 50,
      powerFactor: 0.85,
      maxDemandFactor: 0.8,
      buildings: [
        {
          id: 'bldg-1',
          name: 'Main Building',
          buildingLoads: [],
          floorDesigns: [
            {
              id: 'fd-1',
              floorNumber: 1,
              name: 'Floor 1',
              items: [
                {
                  id: 'item-1',
                  name: 'Apartment 101',
                  type: 'APARTMENT',
                  calculatedConnectedLoad: 15,
                  calculatedMaxDemand: 10,
                  calculatedCurrent: 21.7,
                  assignedPhase: 1,
                  apartmentTemplate: {
                    id: 'tpl-1',
                    name: '2BR Standard',
                    phases: 1,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/floor-items/item-1') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 'item-1', ...body }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  async function renderPage() {
    const Page = (await import('./page')).default;
    return render(<Page />);
  }

  it('allows renaming a load directly from the table and sends PATCH request', async () => {
    mockMutateProject.mockImplementation((updater) => {
      mockProject = updater(mockProject);
    });

    await renderPage();

    // Floor accordion starts collapsed, click Floor 1 header to expand
    const floorHeader = screen.getByText('F1');
    fireEvent.click(floorHeader);

    // Initial name should be visible
    await waitFor(() => {
      expect(screen.getByText('Apartment 101')).toBeInTheDocument();
    });

    // Click edit button for the load name
    const editBtn = screen.getByTitle('Edit load name');
    fireEvent.click(editBtn);

    // Input field should now be present with current name
    const input = screen.getByDisplayValue('Apartment 101');
    expect(input).toBeInTheDocument();

    // Change the name to "Penthouse Suite"
    fireEvent.change(input, { target: { value: 'Penthouse Suite' } });

    // Submit the form
    const saveBtn = screen.getByTitle('Save');
    fireEvent.click(saveBtn);

    // Assert API call
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/floor-items/item-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Penthouse Suite' }),
        })
      );
    });

    // Assert mutateProject updated context and UI updated optimistically
    expect(mockMutateProject).toHaveBeenCalled();
    expect(screen.getByText('Penthouse Suite')).toBeInTheDocument();
  });

  it('cancels renaming when pressing Escape or clicking Cancel', async () => {
    await renderPage();

    const floorHeader = screen.getByText('F1');
    fireEvent.click(floorHeader);

    await waitFor(() => {
      expect(screen.getByText('Apartment 101')).toBeInTheDocument();
    });

    const editBtn = screen.getByTitle('Edit load name');
    fireEvent.click(editBtn);

    const input = screen.getByDisplayValue('Apartment 101');
    fireEvent.change(input, { target: { value: 'Draft Name' } });

    // Press Escape
    fireEvent.keyDown(input, { key: 'Escape' });

    // Name should remain Apartment 101, no PATCH call made
    expect(screen.getByText('Apartment 101')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/floor-items/item-1'),
      expect.anything()
    );
  });

  it('renders name as static text without edit affordance when isReadOnly is true', async () => {
    mockCanEdit = false;

    await renderPage();

    const floorHeader = screen.getByText('F1');
    fireEvent.click(floorHeader);

    await waitFor(() => {
      expect(screen.getByText('Apartment 101')).toBeInTheDocument();
    });

    expect(screen.queryByTitle('Edit load name')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Click to rename')).not.toBeInTheDocument();
  });
});
