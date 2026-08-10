import React from "react";
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
import SermonEditorPage from "./pages/SermonEditorPage";
import SermonEditorTestPage from "./pages/SermonEditorTestPage";
import ArchivoRecursosPage from "./pages/ArchivoRecursosPage";
import UserManagementPage from "./pages/UserManagementPage";
import RoleManagementPage from "./pages/RoleManagementPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import FinancialPage from "./pages/FinancialPage";
import PersonnelPage from "./pages/PersonnelPage";
import MusicLibraryPage from "./pages/MusicLibraryPage";
import MusicSchedulingPage from "./pages/MusicSchedulingPage";
import ChildrenMinistryPage from "./pages/ChildrenMinistryPage";
import LeadershipPage from "./pages/LeadershipPage";
import RecorderPopupPage from "./pages/RecorderPopupPage";
import AdminSignupsPage from "./pages/AdminSignups";
import ReflexionesPage from "./pages/Reflexiones";
import ReflexionEpisodioPage from "./pages/ReflexionEpisodio";

// Real route registration mounted by App.tsx (createBrowserRouter(appRoutes)).
// Lives in its own module so tests can assert guards on the actual routes
// (see ProtectedRoute.liturgyBuilder.test.tsx) without App.tsx exporting
// non-components (react-refresh/only-export-components).
export const appRoutes = [
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
  { path: "/admin/users", element: <ProtectedRoute requires={{ role: 'general_admin' }}><UserManagementPage /></ProtectedRoute> },
  { path: "/admin/roles", element: <ProtectedRoute requires={{ role: 'general_admin' }}><RoleManagementPage /></ProtectedRoute> },
  { path: "/admin/liturgia/temporadas", element: <ProtectedRoute requires={{ resource: 'liturgy_seasons', action: 'write' }}><LiturgicalSeasonAdminPage /></ProtectedRoute> },
  { path: "/admin/liturgia/oraciones", element: <ProtectedRoute requires={{ resource: 'oraciones', action: 'write' }}><OracionesAntifonalesPage /></ProtectedRoute> },
  { path: "/admin/liturgia/canciones", element: <ProtectedRoute requires={{ resource: 'canciones', action: 'write' }}><CancionesPage /></ProtectedRoute> },
  { path: "/admin/liturgia/elementos-fijos", element: <ProtectedRoute requires={{ resource: 'elementos_fijos', action: 'write' }}><ElementosFijosPage /></ProtectedRoute> },
  { path: "/admin/liturgia/constructor", element: <ProtectedRoute requires={{ resource: 'liturgy_builder', action: 'write' }}><ConstructorLiturgiasPage /></ProtectedRoute> },
  { path: "/presenter", element: <PresenterPage /> },
  { path: "/output", element: <OutputPage /> },
  { path: "/admin/sermon-editor", element: <SermonEditorPage /> },
  { path: "/test/sermon-editor", element: <SermonEditorTestPage /> },
  { path: "/recursos/archivo", element: <ArchivoRecursosPage /> },
  // PÚBLICAS a propósito (E3b): sin ProtectedRoute. Lo que se puede ver lo decide la RLS
  // `podcast_episodes_public_read`, que sólo expone `status = 'published'`.
  { path: "/reflexiones", element: <ReflexionesPage /> },
  { path: "/reflexiones/:slug", element: <ReflexionEpisodioPage /> },
  { path: "/admin/finanzas", element: <ProtectedRoute requires={{ resource: 'financial', action: 'read' }}><FinancialPage /></ProtectedRoute> },
  { path: "/admin/finanzas/nomina", element: <ProtectedRoute requires={{ resource: 'financial', action: 'read' }}><PersonnelPage /></ProtectedRoute> },
  { path: "/admin/musica/biblioteca", element: <ProtectedRoute requires={{ resource: 'canciones', action: 'read' }}><MusicLibraryPage /></ProtectedRoute> },
  { path: "/admin/musica/programacion", element: <ProtectedRoute requires={{ resource: 'music_scheduling', action: 'read' }}><MusicSchedulingPage /></ProtectedRoute> },
  { path: "/admin/ninos", element: <ProtectedRoute requires={{ resource: 'children_ministry', action: 'read' }}><ChildrenMinistryPage /></ProtectedRoute> },
  { path: "/admin/liderazgo", element: <ProtectedRoute requires={{ resource: 'leadership', action: 'read' }}><LeadershipPage /></ProtectedRoute> },
  { path: "/recorder", element: <ProtectedRoute requires={{ resource: 'leadership', action: 'write' }}><RecorderPopupPage /></ProtectedRoute> },
  { path: "/admin/inscripciones", element: <ProtectedRoute requires={{ resource: 'signups', action: 'read' }}><AdminSignupsPage /></ProtectedRoute> },
  // Catch-all route for 404
  { path: "*", element: <NotFound /> },
];
