
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mesa-abierta/dashboard" element={<MesaAbiertaDashboardPage />} />
            <Route path="/mesa-abierta/admin" element={<MesaAbiertaAdminPage />} />
            <Route path="/admin/events" element={<EventsAdminPage />} />
            <Route path="/admin/graphics" element={<GraphicsGeneratorPage />} />
            <Route path="/header-demo" element={<HeaderDemo />} />
            <Route path="/expandable-tabs" element={<ExpandableTabsDemo />} />
            <Route path="/hero-demo" element={<HeroDemo />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/anuncios" element={<AnnouncementSlideshow />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/liturgia/temporadas" element={<LiturgicalSeasonAdminPage />} />
            <Route path="/admin/liturgia/oraciones" element={<OracionesAntifonalesPage />} />
            <Route path="/admin/liturgia/canciones" element={<CancionesPage />} />
            <Route path="/admin/liturgia/elementos-fijos" element={<ElementosFijosPage />} />
            <Route path="/admin/liturgia/constructor" element={<ConstructorLiturgiasPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
