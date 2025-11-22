
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
            <Route path="/header-demo" element={<HeaderDemo />} />
            <Route path="/expandable-tabs" element={<ExpandableTabsDemo />} />
            <Route path="/hero-demo" element={<HeroDemo />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
