/**
 * Configuración de la Temporada Litúrgica Actual
 *
 * Editar este archivo cuando cambie la temporada litúrgica (~4-6 veces al año)
 * Referencia: Book of Common Prayer / Calendario Litúrgico Anglicano
 *
 * Temporadas del Año Litúrgico:
 * - Adviento (4 domingos antes de Navidad)
 * - Navidad (25 dic - 5 ene)
 * - Epifanía (6 ene - antes de Cuaresma)
 * - Cuaresma (Miércoles de Ceniza - Sábado Santo)
 * - Pascua (Domingo de Resurrección - Pentecostés)
 * - Pentecostés (50 días después de Pascua)
 * - Tiempo Ordinario (después de Pentecostés)
 */

export interface LiturgicalSeason {
  id: string;
  name: string;
  scripture: {
    reference: string;
    text: string;
  };
  theme: string;
  accentColor?: string;
}

export const currentSeason: LiturgicalSeason = {
  id: "ordinary",
  name: "Tiempo Ordinario",

  scripture: {
    reference: "Miqueas 6:8",
    text: "Practicar la justicia, amar la misericordia, y caminar humildemente con tu Dios"
  },

  theme: "Crecemos juntos en fe y comunidad",

  // Color de acento (opcional, default: ámbar #D4A853)
  // Tiempo Ordinario usa verde litúrgico
  accentColor: "#2E8B57"
};

/**
 * Citas sugeridas para cada temporada (referencia para futuras actualizaciones):
 *
 * Epifanía:    Mateo 2:2 - "Hemos visto su estrella..."
 * Cuaresma:    Joel 2:13 - "Rasgad vuestro corazón y no vuestros vestidos..."
 * Pascua:      Juan 11:25 - "Yo soy la resurrección y la vida..."
 * Pentecostés: Hechos 2:4 - "Todos fueron llenos del Espíritu Santo..."
 * Ordinario:   Miqueas 6:8 - "Practicar la justicia, amar la misericordia..."
 * Adviento:    Isaías 40:3 - "Preparad el camino del Señor..."
 * Navidad:     Lucas 2:10-11 - "Os traigo buenas nuevas de gran gozo..."
 */
