import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MesaAbiertaDashboard } from '../MesaAbiertaDashboard';

// Mock AuthContext
vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' }
  })
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Create a variable to hold the current test data
let mockParticipantData: any = null;
let mockParticipantError: any = null;

// Mock Supabase with a simpler approach
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'mesa_abierta_participants') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: () => ({
                  limit: () => ({
                    single: () => Promise.resolve({
                      data: mockParticipantData,
                      error: mockParticipantError
                    })
                  })
                })
              })
            })
          })
        };
      } else if (table === 'mesa_abierta_assignments') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
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
  });

  it('shows empty state when user has no participation', async () => {
    // Set up mock data for this test
    mockParticipantData = null;
    mockParticipantError = { code: 'PGRST116' };

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No estás inscrito/i)).toBeInTheDocument();
      expect(screen.getByText(/Aún no te has inscrito/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows pending status for unassigned participant', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: null,
      has_plus_one: false,
      status: 'pending',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: []
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Esperando asignación/i)).toBeInTheDocument();
      expect(screen.getByText(/invitado/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned guest', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: [{
        food_assignment: 'salad',
        mesa_abierta_matches: {
          id: 'match-id',
          dinner_date: '2025-12-13',
          dinner_time: '19:00',
          host_participant: {
            host_address: '123 Main St, City'
          }
        }
      }]
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Tu cena está confirmada/i)).toBeInTheDocument();
      expect(screen.getByText(/Ensalada/i)).toBeInTheDocument();
      expect(screen.getByText(/123 Main St, City/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned host', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'host',
      assigned_role: 'host',
      has_plus_one: false,
      status: 'confirmed',
      host_address: '456 Oak Ave',
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: [{
        food_assignment: 'none',
        mesa_abierta_matches: {
          id: 'match-id',
          dinner_date: '2025-12-13',
          dinner_time: '19:00',
          host_participant: {
            host_address: '456 Oak Ave'
          }
        }
      }]
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Serás anfitrión/i)).toBeInTheDocument();
      expect(screen.getByText(/Invitados esperados/i)).toBeInTheDocument();
    });
  });

  it('displays calendar button for assigned participants', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: [{
        food_assignment: 'salad',
        mesa_abierta_matches: {
          id: 'match-id',
          dinner_date: '2025-12-13',
          dinner_time: '19:00',
          host_participant: {
            host_address: '123 Main St'
          }
        }
      }]
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Agregar al Calendario/i })).toBeInTheDocument();
    });
  });

  it('shows cancel button for non-cancelled participants', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: null,
      has_plus_one: false,
      status: 'pending',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: []
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancelar Participación/i })).toBeInTheDocument();
    });
  });

  it('displays mystery reminder for assigned participants', async () => {
    // Set up mock data (use a future date)
    mockParticipantData = {
      id: 'participant-id',
      role_preference: 'guest',
      assigned_role: 'guest',
      has_plus_one: false,
      status: 'confirmed',
      host_address: null,
      phone_number: null,
      mesa_abierta_months: {
        dinner_date: '2025-12-13',
        month_date: '2025-12-01'
      },
      mesa_abierta_assignments: [{
        food_assignment: 'salad',
        mesa_abierta_matches: {
          id: 'match-id',
          dinner_date: '2025-12-13',
          dinner_time: '19:00',
          host_participant: {
            host_address: '123 Main St'
          }
        }
      }]
    };
    mockParticipantError = null;

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Recuerda el misterio/i)).toBeInTheDocument();
    });
  });
});
