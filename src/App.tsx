
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import HeaderDemo from "./pages/HeaderDemo";
import ExpandableTabsDemo from "./pages/ExpandableTabsDemo";
import HeroDemo from "./pages/HeroDemo";
import MesaAbiertaDashboardPage from "./pages/MesaAbiertaDashboard";
import MesaAbiertaAdminPage from "./pages/MesaAbiertaAdmin";
import EventsAdminPage from "./pages/EventsAdmin";
import GraphicsGeneratorPage from "./pages/GraphicsGeneratorPage";
import ResetPassword from "./pages/ResetPassword";
import ProfilePage from "./pages/ProfilePage";
import AnnouncementSlideshow from "./pages/AnnouncementSlideshow";
import LiturgicalSeasonAdminPage from "./pages/LiturgicalSeasonAdminPage";
import OracionesAntifonalesPage from "./pages/OracionesAntifonalesPage";
import CancionesPage from "./pages/Canciones";
import AdminDashboard from "./pages/AdminDashboard";
import ElementosFijosPage from "./pages/ElementosFijosPage";
import ConstructorLiturgiasPage from "./pages/ConstructorLiturgiasPage";
import PresenterPage from "./pages/PresenterPage";
import OutputPage from "./pages/OutputPage";

const queryClient = new QueryClient();

// Create router with data router API (required for useBlocker)
const router = createBrowserRouter([
  { path: "/", element: <Index /> },
  { path: "/mesa-abierta/dashboard", element: <MesaAbiertaDashboardPage /> },
  { path: "/mesa-abierta/admin", element: <MesaAbiertaAdminPage /> },
  { path: "/admin/events", element: <EventsAdminPage /> },
  { path: "/admin/graphics", element: <GraphicsGeneratorPage /> },
  { path: "/header-demo", element: <HeaderDemo /> },
  { path: "/expandable-tabs", element: <ExpandableTabsDemo /> },
  { path: "/hero-demo", element: <HeroDemo /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/profile", element: <ProfilePage /> },
  { path: "/anuncios", element: <AnnouncementSlideshow /> },
  { path: "/admin", element: <AdminDashboard /> },
  { path: "/admin/liturgia/temporadas", element: <LiturgicalSeasonAdminPage /> },
  { path: "/admin/liturgia/oraciones", element: <OracionesAntifonalesPage /> },
  { path: "/admin/liturgia/canciones", element: <CancionesPage /> },
  { path: "/admin/liturgia/elementos-fijos", element: <ElementosFijosPage /> },
  { path: "/admin/liturgia/constructor", element: <ConstructorLiturgiasPage /> },
  { path: "/presenter", element: <PresenterPage /> },
  { path: "/output", element: <OutputPage /> },
  // Catch-all route for 404
  { path: "*", element: <NotFound /> },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
