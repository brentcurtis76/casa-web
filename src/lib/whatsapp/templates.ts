// WhatsApp utility template registry.
// Templates must be pre-registered + approved in WhatsApp Business Manager
// under category UTILITY, language 'es'. Body uses {{1}}, {{2}}, ... placeholders.
// Quick-reply button labels must be <= 25 chars; payloads are set per-send.
// NOTE: editing a template body in WhatsApp Manager triggers re-approval (24-48h).

export type WhatsAppTemplateDef = {
  name: string;
  language: 'es';
  category: 'UTILITY';
  /** Body copy with numbered placeholders. For documentation / WhatsApp Manager registration. */
  body: string;
  /** Variable hints in order, for developer reference. */
  variables: string[];
  /** Optional quick-reply button labels (<= 25 chars). Payload is provided per-send. */
  buttons?: { label: string }[];
};

export const WA_TEMPLATES = {
  asignacion_servicio: {
    name: 'asignacion_servicio',
    language: 'es',
    category: 'UTILITY',
    body:
      'Hola {{1}}, te asignamos al servicio del {{2}} como {{3}}. ¿Puedes confirmar tu asistencia?',
    variables: ['nombre', 'fecha', 'rol_o_instrumento'],
    buttons: [{ label: 'Confirmar' }, { label: 'No puedo' }],
  },
  recordatorio_semana: {
    name: 'recordatorio_semana',
    language: 'es',
    category: 'UTILITY',
    body:
      'Hola {{1}}, recordatorio: tienes servicio el {{2}} como {{3}}. Aún no confirmas. ¿Puedes hacerlo ahora?',
    variables: ['nombre', 'fecha', 'rol_o_instrumento'],
    buttons: [{ label: 'Confirmar' }, { label: 'No puedo' }],
  },
  recordatorio_dia: {
    name: 'recordatorio_dia',
    language: 'es',
    category: 'UTILITY',
    body:
      'Hola {{1}}, mañana es el servicio ({{2}}) y aún no confirmas tu participación como {{3}}. Por favor responde:',
    variables: ['nombre', 'fecha', 'rol_o_instrumento'],
    buttons: [{ label: 'Confirmar' }, { label: 'No puedo' }],
  },
  cambio_servicio: {
    name: 'cambio_servicio',
    language: 'es',
    category: 'UTILITY',
    body:
      'Hola {{1}}, hubo un cambio en el servicio del {{2}}: {{3}}. Por favor revisa el detalle con el coordinador.',
    variables: ['nombre', 'fecha', 'detalle_cambio'],
  },
  solicitud_disponibilidad: {
    name: 'solicitud_disponibilidad',
    language: 'es',
    category: 'UTILITY',
    body:
      'Hola {{1}}, estamos armando la programación de {{2}}. ¿Puedes indicarnos tu disponibilidad para esa fecha?',
    variables: ['nombre', 'mes_o_periodo'],
  },
  opt_in_bienvenida: {
    name: 'opt_in_bienvenida',
    language: 'es',
    category: 'UTILITY',
    // Compliance: names the church explicitly and explains how to opt out.
    // Ministry-agnostic so the same approved template serves música y niños.
    body:
      'Hola {{1}}, activaste las notificaciones de programación de CASA (Comunidad Anglicana San Andrés). Te enviaremos asignaciones, recordatorios y cambios de servicio por aquí. Responde BAJA si ya no quieres recibirlos.',
    variables: ['nombre'],
  },
} as const satisfies Record<string, WhatsAppTemplateDef>;

export type WhatsAppTemplateName = keyof typeof WA_TEMPLATES;

export function getTemplate(name: WhatsAppTemplateName): WhatsAppTemplateDef {
  return WA_TEMPLATES[name];
}
