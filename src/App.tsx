
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";
import ForcePasswordChangeModal from "@/components/auth/ForcePasswordChangeModal";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { appRoutes } from "./appRoutes";

const queryClient = new QueryClient();

// Create router with data router API (required for useBlocker).
// The route registration lives in src/appRoutes.tsx so tests can assert
// route guards against the exact tree mounted here.
const router = createBrowserRouter(appRoutes);

/**
 * ForcePasswordChangeGate — Renders the ForcePasswordChangeModal as a
 * blocking overlay when the user has must_change_password === true.
 * The children (RouterProvider) still render underneath but are blocked.
 */
function ForcePasswordChangeGate({ children }: { children: React.ReactNode }) {
  const { user, loading, mustChangePassword } = useAuth();

  return (
    <>
      {children}
      {!loading && user && mustChangePassword && <ForcePasswordChangeModal />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScrollToTop />
        <ForcePasswordChangeGate>
          <RouterProvider router={router} />
        </ForcePasswordChangeGate>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
