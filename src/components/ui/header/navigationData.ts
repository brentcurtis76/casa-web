
import { Mail, Home, Info, Church, Users, Calendar, BookOpen, HeartHandshake, Instagram } from "lucide-react";

export const navigationItems = [
  {
    title: "Inicio",
    link: "/",
    icon: Home
  },
  {
    title: "Sentido & Propósito",
    link: "/#proposito",
    icon: Info
  },
  {
    title: "Casa",
    link: "#",
    icon: Church,
    subItems: [
      {
        title: "Equipo y Liderazgo",
        link: "/#equipo",
        description: "Conoce al equipo que lidera nuestra congregación con pasión y visión.",
        icon: Users
      },
      {
        title: "Eventos",
        link: "/#eventos",
        description: "Explora nuestros próximos eventos y actividades comunitarias.",
        icon: Calendar
      }
    ]
  },
  {
    title: "Recursos",
    link: "#",
    icon: BookOpen,
    subItems: [
      {
        title: "Reflexiones",
        link: "/#sermones",
        description: "Accede a nuestras reflexiones semanales.",
        icon: BookOpen
      },
      {
        title: "Oración",
        link: "/#oracion",
        description: "Comparte tus peticiones de oración con nuestra comunidad.",
        icon: HeartHandshake
      },
      {
        title: "Instagram",
        link: "/#instagram",
        description: "Síguenos en Instagram para mantente conectado.",
        icon: Instagram
      }
    ]
  },
  {
    title: "Componentes",
    link: "#",
    icon: BookOpen,
    subItems: [
      {
        title: "Header Demo",
        link: "/header-demo",
        description: "Demostración del componente Header.",
        icon: Home
      },
      {
        title: "Expandable Tabs",
        link: "/expandable-tabs",
        description: "Demostración del componente de pestañas expandibles.",
        icon: Calendar
      }
    ]
  }
];
