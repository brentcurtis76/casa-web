import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMusicians, useQueueNotification, useQueueBatchNotifications } from '@/hooks/useMusicLibrary';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from '@/lib/music-planning/notificationLabels';
import type { NotificationType, NotificationChannel } from '@/types/musicPlanning';
import { CASA_BRAND } from '@/lib/brand-kit';

interface NotificationQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NotificationQueueDialog: React.FC<NotificationQueueDialogProps> = ({ open, onOpenChange }) => {
  const [recipientId, setRecipientId] = useState<string>('all');
  const [notificationType, setNotificationType] = useState<NotificationType>('rehearsal_invite');
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [customMessage, setCustomMessage] = useState('');

  const { data: musicians } = useMusicians({ isActive: true });
  const queueOne = useQueueNotification();
  const queueBatch = useQueueBatchNotifications();
  const isPending = queueOne.isPending || queueBatch.isPending;

  const handleClose = () => {
    setRecipientId('all');
    setNotificationType('rehearsal_invite');
    setChannel('email');
    setCustomMessage('');
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (recipientId === 'all') {
      const eligible = (musicians ?? []).filter((m) => {
        if (channel === 'email') return !!m.email;
        if (channel === 'whatsapp') return !!m.phone && m.whatsapp_enabled;
        return false;
      });

      queueBatch.mutate(
        {
          recipients: eligible.map((m) => ({
            id: m.id,
            displayName: m.display_name,
            channel,
          })),
          type: notificationType,
          context: { customMessage: customMessage.trim() || undefined },
        },
        { onSuccess: () => handleClose() }
      );
    } else {
      const musician = (musicians ?? []).find((m) => m.id === recipientId);
      if (!musician) return;

      queueOne.mutate(
        {
          recipientId: musician.id,
          recipientName: musician.display_name,
          type: notificationType,
          channel,
          context: { recipientName: musician.display_name, customMessage: customMessage.trim() || undefined },
        },
        { onSuccess: () => handleClose() }
      );
    }
  };

  const selectedMusician = recipientId !== 'all'
    ? (musicians ?? []).find((m) => m.id === recipientId)
    : null;

  const channelWarning = selectedMusician
    ? (channel === 'email' && !selectedMusician.email)
      ? 'Este músico no tiene email registrado.'
      : (channel === 'whatsapp' && (!selectedMusician.phone || !selectedMusician.whatsapp_enabled))
        ? 'Este músico no tiene WhatsApp habilitado.'
        : null
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: CASA_BRAND.fonts.heading, fontWeight: 300 }}>
            Enviar notificación
          </DialogTitle>
          <DialogDescription>
            Encolar una notificación para envío. El mensaje será generado automáticamente según el tipo seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label style={{ color: CASA_BRAND.colors.primary.black }}>Destinatario</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar destinatario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los músicos activos</SelectItem>
                {(musicians ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: CASA_BRAND.colors.primary.black }}>Tipo de notificación</Label>
            <Select value={notificationType} onValueChange={(v) => setNotificationType(v as NotificationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(NOTIFICATION_TYPE_LABELS) as [NotificationType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: CASA_BRAND.colors.primary.black }}>Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(NOTIFICATION_CHANNEL_LABELS) as [NotificationChannel, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channelWarning && (
              <p className="text-sm" style={{ color: CASA_BRAND.colors.amber.dark }}>
                {channelWarning}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label style={{ color: CASA_BRAND.colors.primary.black }}>
              Mensaje personalizado (opcional)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Escribe un mensaje personalizado..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationQueueDialog;
