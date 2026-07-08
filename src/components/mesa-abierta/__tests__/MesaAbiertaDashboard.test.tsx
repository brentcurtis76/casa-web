import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MesaAbiertaDashboard } from '../MesaAbiertaDashboard';

// Mock AuthContext. The user object must be stable across calls: the
// component's useEffect depends on [user], so a fresh object per render
// re-fires the effect forever and the dashboard never leaves its spinner.
vi.mock('@/components/auth/AuthContext', () => {
  const user = { id: 'test-user-id', email: 'test@example.com' };
  return {
    useAuth: () => ({ user })
  };
});

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// The component discards dinners whose dinner_date is before now, so test
// dates must be computed at runtime — hardcoded "future" dates expire and
// silently turn every test into the empty state.
const future = new Date(Date.now() + 30 * 86400000);
const dinnerDate = future.toISOString().slice(0, 10);
const monthDate = dinnerDate.slice(0, 8) + '01';

// Variables to hold the current test data
interface MockParticipant {
  id: string;
  role_preference: 'host' | 'guest';
  assigned_role: 'host' | 'guest' | null;
  has_plus_one: boolean;
  status: string;
  host_address: string | null;
  phone_number: string | null;
  mesa_abierta_months: { dinner_date: string; month_date: string };
}

interface MockAssignment {
  food_assignment: string;
  mesa_abierta_matches: {
    dinner_date: string;
    dinner_time: string;
    host_participant: { host_address: string };
  };
}

let mockParticipantData: MockParticipant | null = null;
let mockParticipantError: { code: string } | null = null;
let mockAssignmentData: MockAssignment | null = null;

// Mock Supabase matching the component's two-step fetch:
// 1. participants: .select().eq('user_id', ...).neq('status', 'cancelled') → array
// 2. assignments (only when assigned_role is set):
//    .select().eq('participant_id', ...).single() → single object
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'mesa_abierta_participants') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({
                data: mockParticipantData ? [mockParticipantData] : [],
                error: mockParticipantError
              })
            })
          })
        };
      } else if (table === 'mesa_abierta_assignments') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: mockAssignmentData,
                error: null
              })
            })
          })
        };
      }
      return {};
    }
  }
}));

describe('MesaAbiertaDashboard', () => {
  beforeEach(() => {
    // Reset mock data before each test
    mockParticipantData = null;
    mockParticipantError = null;
    mockAssignmentData = null;
  });

  it('shows empty state when user has no participation', async () => {
    mockParticipantData = null;
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No estás inscrito/i)).toBeInTheDocument();
      expect(screen.getByText(/Aún no te has inscrito/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows pending status for unassigned participant', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: null,
      has_plus_one: false,
      status: 'pending',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      // Exact case-sensitive match: the status badge ("⏳ Esperando Asignación")
      // also matches a case-insensitive regex.
      expect(screen.getByText('Esperando asignación')).toBeInTheDocument();
      expect(screen.getByText(/invitado/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned guest', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };
    mockAssignmentData = {
      food_assignment: 'salad',
      mesa_abierta_matches: {
        dinner_date: dinnerDate,
        dinner_time: '19:00',
        host_participant: {
          host_address: '123 Main St, City'
        }
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Tu cena está confirmada/i)).toBeInTheDocument();
      expect(screen.getByText(/Ensalada/i)).toBeInTheDocument();
      expect(screen.getByText(/123 Main St, City/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned host', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'host',
      assigned_role: 'host',
      has_plus_one: false,
      status: 'confirmed',
      host_address: '456 Oak Ave',
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };
    mockAssignmentData = {
      food_assignment: 'none',
      mesa_abierta_matches: {
        dinner_date: dinnerDate,
        dinner_time: '19:00',
        host_participant: {
          host_address: '456 Oak Ave'
        }
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Serás anfitrión/i)).toBeInTheDocument();
      expect(screen.getByText(/Invitados esperados/i)).toBeInTheDocument();
    });
  });

  it('displays calendar button for assigned participants', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };
    mockAssignmentData = {
      food_assignment: 'salad',
      mesa_abierta_matches: {
        dinner_date: dinnerDate,
        dinner_time: '19:00',
        host_participant: {
          host_address: '123 Main St'
        }
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Agregar al Calendario/i })).toBeInTheDocument();
    });
  });

  it('shows cancel button for non-cancelled participants', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: null,
      has_plus_one: false,
      status: 'pending',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancelar Participación/i })).toBeInTheDocument();
    });
  });

  it('displays mystery reminder for assigned participants', async () => {
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: dinnerDate,
        month_date: monthDate
      }
    };
    mockAssignmentData = {
      food_assignment: 'salad',
      mesa_abierta_matches: {
        dinner_date: dinnerDate,
        dinner_time: '19:00',
        host_participant: {
          host_address: '123 Main St'
        }
      }
    };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Recuerda el misterio/i)).toBeInTheDocument();
    });
  });
});
