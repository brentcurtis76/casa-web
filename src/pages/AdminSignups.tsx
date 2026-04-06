import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Users, Clock, CheckCircle2, XCircle, Download, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChurchSignup, SignupFormType, SignupStatus } from '@/types/signups';

// ── Constants ──────────────────────────────────────────────────────────────

const TAB_CONFIG: { value: SignupFormType; label: string }[] = [
  { value: 'grupos_casa', label: 'Grupos en CASA' },
  { value: 'club_lectura', label: 'Club de Lectura' },
  { value: 'apoyo_psicoemocional', label: 'Apoyo Psico-emocional' },
];

const GROUP_SLOT_LABELS: Record<string, string> = {
  jueves_19: 'Jueves 19:00 - 21:00 hrs',
  martes_10: 'Martes 10:00 - 12:00 hrs',
};

const STATUS_CONFIG: Record<SignupStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
};

type StatusFilter = SignupStatus | 'all';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getGrupoHorario(signup: ChurchSignup): string {
  switch (signup.form_type) {
    case 'grupos_casa':
      return signup.comuna || '—';
    case 'club_lectura':
      return 'Online';
    case 'apoyo_psicoemocional':
      return signup.group_slot ? (GROUP_SLOT_LABELS[signup.group_slot] || signup.group_slot) : '—';
    default:
      return '—';
  }
}

function exportCSV(signups: ChurchSignup[], formType: SignupFormType) {
  const headers = ['Nombre', 'Email', 'Teléfono', 'Grupo/Horario', 'Fecha Inscripción', 'Estado'];
  const rows = signups.map((s) => [
    s.full_name,
    s.email,
    s.phone || '—',
    getGrupoHorario(s),
    formatDate(s.created_at),
    STATUS_CONFIG[s.status].label,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inscripciones-${formType}-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────────

const AdminSignupsPage: React.FC = () => {
  const { toast } = useToast();
  const [signups, setSignups] = useState<ChurchSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [activeTab, setActiveTab] = useState<SignupFormType>('grupos_casa');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchSignups = useCallback(async () => {
    const { data, error } = await supabase
      .from('church_signups')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching signups:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las inscripciones.', variant: 'destructive' });
    } else {
      setSignups(data as unknown as ChurchSignup[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSignups();
  }, [fetchSignups]);

  // ── Derived Data ───────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const total = signups.length;
    const pending = signups.filter((s) => s.status === 'pending').length;
    const confirmed = signups.filter((s) => s.status === 'confirmed').length;
    const cancelled = signups.filter((s) => s.status === 'cancelled').length;
    return { total, pending, confirmed, cancelled };
  }, [signups]);

  const pendingByTab = useMemo(() => {
    const map: Record<SignupFormType, number> = { grupos_casa: 0, club_lectura: 0, apoyo_psicoemocional: 0 };
    for (const s of signups) {
      if (s.status === 'pending') map[s.form_type]++;
    }
    return map;
  }, [signups]);

  const filteredSignups = useMemo(() => {
    return signups.filter((s) => {
      if (s.form_type !== activeTab) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      return true;
    });
  }, [signups, activeTab, statusFilter]);

  // Clear selection when switching tabs or filter
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, statusFilter]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const updateStatus = async (ids: string[], newStatus: SignupStatus) => {
    setMutating(true);
    const { error } = await supabase
      .from('church_signups')
      .update({ status: newStatus })
      .in('id', ids);

    if (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar el estado.', variant: 'destructive' });
    } else {
      toast({ title: 'Actualizado', description: `${ids.length} inscripción(es) actualizada(s).` });
      setSelectedIds(new Set());
      await fetchSignups();
    }
    setMutating(false);
  };

  // ── Selection Helpers ──────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSignups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSignups.map((s) => s.id)));
    }
  };

  const selectedSignups = filteredSignups.filter((s) => selectedIds.has(s.id));

  // ── Render Helpers ─────────────────────────────────────────────────────

  const renderStatCards = () => {
    const stats = [
      { label: 'Total', value: counts.total, icon: <Users className="h-5 w-5 text-gray-500" /> },
      { label: 'Pendientes', value: counts.pending, icon: <Clock className="h-5 w-5 text-amber-500" /> },
      { label: 'Confirmados', value: counts.confirmed, icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> },
      { label: 'Cancelados', value: counts.cancelled, icon: <XCircle className="h-5 w-5 text-red-500" /> },
    ];

    if (loading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                {stat.icon}
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderBulkToolbar = () => {
    if (selectedIds.size === 0) return null;

    return (
      <div className="flex items-center gap-3 p-3 mb-4 bg-muted rounded-lg">
        <span className="text-sm font-medium">
          {selectedIds.size} seleccionado(s)
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={mutating}
          onClick={() => updateStatus([...selectedIds], 'confirmed')}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Confirmar seleccionados
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutating}
          onClick={() => updateStatus([...selectedIds], 'cancelled')}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Cancelar seleccionados
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportCSV(selectedSignups, activeTab)}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar CSV
        </Button>
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (filteredSignups.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No hay inscripciones en esta categoría.</p>
          <p className="text-sm mt-1">Las nuevas inscripciones aparecerán aquí automáticamente.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === filteredSignups.length && filteredSignups.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Grupo / Horario</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSignups.map((signup) => {
            const cfg = STATUS_CONFIG[signup.status];
            return (
              <TableRow key={signup.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(signup.id)}
                    onCheckedChange={() => toggleSelect(signup.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{signup.full_name}</TableCell>
                <TableCell>{signup.email}</TableCell>
                <TableCell>{signup.phone || '—'}</TableCell>
                <TableCell>{getGrupoHorario(signup)}</TableCell>
                <TableCell>{formatDate(signup.created_at)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cfg.className}>
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {signup.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={mutating}
                        onClick={() => updateStatus([signup.id], 'confirmed')}
                        title="Confirmar"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {signup.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={mutating}
                        onClick={() => updateStatus([signup.id], 'cancelled')}
                        title="Cancelar"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminPageHeader
        title="Gestión de Inscripciones"
        subtitle="Administra las inscripciones a grupos y actividades"
        breadcrumbs={[
          { label: 'General' },
          { label: 'Inscripciones' },
        ]}
        backTo="/admin"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {renderStatCards()}

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as SignupFormType)}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <TabsList>
                {TAB_CONFIG.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    {tab.label}
                    {pendingByTab[tab.value] > 0 && (
                      <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 text-xs px-1.5 py-0">
                        {pendingByTab[tab.value]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="confirmed">Confirmados</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                {mutating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {TAB_CONFIG.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {renderBulkToolbar()}
                {renderTable()}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AdminSignupsPage;
