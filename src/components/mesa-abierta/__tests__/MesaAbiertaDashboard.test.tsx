import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MesaAbiertaDashboard } from '../MesaAbiertaDashboard';
import { supabase } from '@/integrations/supabase/client';

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

describe('MesaAbiertaDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    render(<MesaAbiertaDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when user has no participation', async () => {
    // Mock empty response
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No estás inscrito/i)).toBeInTheDocument();
      expect(screen.getByText(/Aún no te has inscrito/i)).toBeInTheDocument();
    });
  });

  it('shows pending status for unassigned participant', async () => {
    // Mock pending participant
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'guest',
          assigned_role: null,
          has_plus_one: false,
          status: 'pending',
          host_address: null,
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: []
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Esperando asignación/i)).toBeInTheDocument();
      expect(screen.getByText(/invitado/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned guest', async () => {
    // Mock assigned guest
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'guest',
          assigned_role: 'guest',
          has_plus_one: false,
          status: 'confirmed',
          host_address: null,
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: [{
            food_assignment: 'salad',
            mesa_abierta_matches: {
              id: 'match-id',
              dinner_date: '2024-12-13',
              dinner_time: '19:00',
              host_participant: {
                host_address: '123 Main St, City'
              }
            }
          }]
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Tu cena está confirmada/i)).toBeInTheDocument();
      expect(screen.getByText(/Ensalada/i)).toBeInTheDocument();
      expect(screen.getByText(/123 Main St, City/i)).toBeInTheDocument();
    });
  });

  it('shows assignment details for assigned host', async () => {
    // Mock assigned host
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'host',
          assigned_role: 'host',
          has_plus_one: false,
          status: 'confirmed',
          host_address: '456 Oak Ave',
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: [{
            food_assignment: 'none',
            mesa_abierta_matches: {
              id: 'match-id',
              dinner_date: '2024-12-13',
              dinner_time: '19:00',
              host_participant: {
                host_address: '456 Oak Ave'
              }
            }
          }]
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Serás anfitrión/i)).toBeInTheDocument();
      expect(screen.getByText(/Invitados esperados/i)).toBeInTheDocument();
    });
  });

  it('displays calendar button for assigned participants', async () => {
    // Mock assigned participant
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'guest',
          assigned_role: 'guest',
          has_plus_one: false,
          status: 'confirmed',
          host_address: null,
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: [{
            food_assignment: 'salad',
            mesa_abierta_matches: {
              id: 'match-id',
              dinner_date: '2024-12-13',
              dinner_time: '19:00',
              host_participant: {
                host_address: '123 Main St'
              }
            }
          }]
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Agregar al Calendario/i })).toBeInTheDocument();
    });
  });

  it('shows cancel button for non-cancelled participants', async () => {
    // Mock pending participant
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'guest',
          assigned_role: null,
          has_plus_one: false,
          status: 'pending',
          host_address: null,
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: []
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancelar Participación/i })).toBeInTheDocument();
    });
  });

  it('displays mystery reminder for assigned participants', async () => {
    // Mock assigned guest
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'participant-id',
          role_preference: 'guest',
          assigned_role: 'guest',
          has_plus_one: false,
          status: 'confirmed',
          host_address: null,
          phone_number: null,
          mesa_abierta_months: {
            dinner_date: '2024-12-13',
            month_date: '2024-12-01'
          },
          mesa_abierta_assignments: [{
            food_assignment: 'salad',
            mesa_abierta_matches: {
              id: 'match-id',
              dinner_date: '2024-12-13',
              dinner_time: '19:00',
              host_participant: {
                host_address: '123 Main St'
              }
            }
          }]
        },
        error: null
      })
    } as any);

    render(<MesaAbiertaDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Recuerda el misterio/i)).toBeInTheDocument();
    });
  });
});
