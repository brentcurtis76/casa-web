import React, { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useNotificationLogs,
  useNotificationStats,
  useDeleteNotificationLog,
} from '@/hooks/useMusicLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Bell,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
} from '@/lib/music-planning/notificationLabels';
import { CASA_BRAND } from '@/lib/brand-kit';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  NotificationType,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@/types/musicPlanning';
import NotificationQueueDialog from './NotificationQueueDialog';

const getStatusVariant = (status: NotificationDeliveryStatus) => {
  switch (status) {
    case 'delivered': return 'default' as const;
    case 'sent': return 'secondary' as const;
    case 'failed': return 'destructive' as const;
    default: return 'outline' as const; // queued
  }
};

const NotificationCenter: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<NotificationDeliveryStatus | 'all'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);

  const { canRead, canWrite, canManage, loading: permLoading } = usePermissions('music_scheduling');

  const filters = useMemo(() => ({
    ...(typeFilter !== 'all' ? { notificationType: typeFilter } : {}),
    ...(channelFilter !== 'all' ? { channel: channelFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }), [typeFilter, channelFilter, statusFilter]);

  const { data: logs, isLoading } = useNotificationLogs(filters);
  const { data: stats } = useNotificationStats();
  const deleteLog = useDeleteNotificationLog();

  const handleDelete = () => {
    if (!deletingLogId) return;
    deleteLog.mutate(deletingLogId, {
      onSettled: () => {
        setDeleteConfirmOpen(false);
        setDeletingLogId(null);
      },
    });
  };

  // Permission gating — same pattern as RehearsalManager
  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acceso denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para ver las notificaciones. Contacta al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5" style={{ color: CASA_BRAND.colors.primary.black }} />
        <h2
          className="text-xl"
          style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300, color: CASA_BRAND.colors.primary.black }}
        >
          Centro de Notificaciones
        </h2>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg p-4 bg-amber-50 border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>En cola</p>
          <p className="text-2xl" style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300, color: CASA_BRAND.colors.primary.black }}>
            {stats?.queued ?? 0}
          </p>
        </div>
        <div className="rounded-lg p-4 bg-blue-50 border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Enviados</p>
          <p className="text-2xl" style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300, color: CASA_BRAND.colors.primary.black }}>
            {stats?.sent ?? 0}
          </p>
        </div>
        <div className="rounded-lg p-4 bg-green-50 border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Entregados</p>
          <p className="text-2xl" style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300, color: CASA_BRAND.colors.primary.black }}>
            {stats?.delivered ?? 0}
          </p>
        </div>
        <div className="rounded-lg p-4 bg-red-50 border" style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}>
          <p className="text-sm" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>Fallidos</p>
          <p className="text-2xl" style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300, color: CASA_BRAND.colors.primary.black }}>
            {stats?.failed ?? 0}
          </p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as NotificationType | 'all')}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {(Object.entries(NOTIFICATION_TYPE_LABELS) as [NotificationType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as NotificationChannel | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {(Object.entries(NOTIFICATION_CHANNEL_LABELS) as [NotificationChannel, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as NotificationDeliveryStatus | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.entries(NOTIFICATION_STATUS_LABELS) as [NotificationDeliveryStatus, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canWrite && (
          <Button onClick={() => setQueueDialogOpen(true)} className="gap-1.5 ml-auto">
            <Send className="h-4 w-4" />
            Enviar notificación
          </Button>
        )}
      </div>

      {/* Log List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (logs ?? []).length === 0 ? (
        <div className="text-center py-12" style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
          No hay notificaciones registradas.
        </div>
      ) : (
        <div className="space-y-2">
          {(logs ?? []).map((log) => (
            <div key={log.id}>
              <div
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                {/* Date */}
                <span className="text-sm shrink-0 w-[130px]" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                  {format(parseISO(log.created_at), 'd MMM yyyy HH:mm', { locale: es })}
                </span>

                {/* Type Badge */}
                <Badge variant="outline" className="shrink-0">
                  {NOTIFICATION_TYPE_LABELS[log.notification_type]}
                </Badge>

                {/* Channel Icon */}
                <span className="flex items-center gap-1 shrink-0" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                  {log.channel === 'email' ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  <span className="text-xs">{log.channel ? NOTIFICATION_CHANNEL_LABELS[log.channel] : ''}</span>
                </span>

                {/* Status Badge */}
                <Badge variant={getStatusVariant(log.status)} className="shrink-0">
                  {NOTIFICATION_STATUS_LABELS[log.status]}
                </Badge>

                {/* Subject */}
                <span
                  className="text-sm truncate flex-1 min-w-0"
                  style={{ color: CASA_BRAND.colors.primary.black }}
                >
                  {log.subject ?? ''}
                </span>

                {/* Expand/Collapse */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  className="shrink-0"
                >
                  {expandedLogId === log.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>

                {/* Delete Button */}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDeletingLogId(log.id);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Expanded Detail */}
              {expandedLogId === log.id && (
                <div
                  className="ml-4 mt-1 mb-2 p-4 rounded-lg border space-y-2"
                  style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                      Asunto:
                    </span>
                    <span className="text-sm ml-2" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                      {log.subject ?? '—'}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1" style={{ color: CASA_BRAND.colors.primary.black }}>
                      Mensaje:
                    </p>
                    <div
                      className="rounded p-3 text-sm"
                      style={{ backgroundColor: CASA_BRAND.colors.primary.white, color: CASA_BRAND.colors.secondary.grayDark }}
                    >
                      {log.message_content ?? '—'}
                    </div>
                  </div>

                  {log.sent_at && (
                    <div>
                      <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        Enviado:
                      </span>
                      <span className="text-sm ml-2" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        {format(parseISO(log.sent_at), 'd MMM yyyy HH:mm', { locale: es })}
                      </span>
                    </div>
                  )}

                  {log.delivered_at && (
                    <div>
                      <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        Entregado:
                      </span>
                      <span className="text-sm ml-2" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        {format(parseISO(log.delivered_at), 'd MMM yyyy HH:mm', { locale: es })}
                      </span>
                    </div>
                  )}

                  {log.external_id && (
                    <div>
                      <span className="text-sm font-medium" style={{ color: CASA_BRAND.colors.primary.black }}>
                        ID externo:
                      </span>
                      <span className="text-sm ml-2 font-mono" style={{ color: CASA_BRAND.colors.secondary.grayDark }}>
                        {log.external_id}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar notificación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este registro de notificación? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLog.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Queue Dialog */}
      <NotificationQueueDialog open={queueDialogOpen} onOpenChange={setQueueDialogOpen} />
    </div>
  );
};

export default NotificationCenter;
