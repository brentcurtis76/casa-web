
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { User, LayoutDashboard, type LucideIcon } from 'lucide-react';
import { useAuth } from "@/components/auth/AuthContext";
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@/components/auth/AuthContext';

interface NavigationSubItem {
    title: string;
    link: string;
    description: string;
    icon: LucideIcon;
}

interface NavigationItem {
    title: string;
    link: string;
    icon: LucideIcon;
    subItems?: NavigationSubItem[];
}

interface MobileMenuProps {
    isOpen: boolean;
    navigationItems: NavigationItem[];
    user: SupabaseUser | null;
    profile: UserProfile | null;
    logout: () => void;
    openAuthModal: () => void;
    openContactModal: () => void;
    openDonationModal: () => void;
    closeMenu: () => void;
}

export function MobileMenu({
    isOpen,
    user,
    logout,
    openAuthModal,
    openContactModal,
    openDonationModal,
    closeMenu
}: MobileMenuProps) {
    const navigate = useNavigate();
    const { roles } = useAuth();
    const hasAdminAccess = roles.length > 0;

    if (!isOpen) return null;

    return (
        <div className="container absolute top-[100%] left-0 right-0 z-40 bg-white py-4 border-t border-muted">
            <div className="flex flex-col space-y-4">
                <Button
                    variant="outline"
                    onClick={() => {
                        openContactModal();
                        closeMenu();
                    }}
                    className="w-full mb-4"
                >
                    Contactar
                </Button>

                <Button
                    onClick={() => {
                        openDonationModal();
                        closeMenu();
                    }}
                    className="w-full mb-4"
                >
                    Haz un aporte
                </Button>

                {user ? (
                    <div className="space-y-3">
                        <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            onClick={() => {
                                navigate('/profile');
                                closeMenu();
                            }}
                        >
                            <User size={16} />
                            Mi Perfil
                        </Button>
                        {hasAdminAccess && (
                            <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2"
                                onClick={() => {
                                    navigate('/admin');
                                    closeMenu();
                                }}
                            >
                                <LayoutDashboard size={16} />
                                Panel de Administración
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => {
                                logout();
                                closeMenu();
                            }}
                            className="w-full"
                        >
                            Cerrar Sesión
                        </Button>
                    </div>
                ) : (
                    <Button
                        onClick={() => {
                            openAuthModal();
                            closeMenu();
                        }}
                        className="w-full"
                    >
                        Iniciar Sesión
                    </Button>
                )}
            </div>
        </div>
    );
}
