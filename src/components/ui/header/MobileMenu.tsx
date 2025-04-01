
import React from 'react';
import { Link } from "react-router-dom";
import { NavigationMenuItems } from "./NavigationMenuItems";
import { Button } from "@/components/ui/button";
import { User } from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    navigationItems: any[];
    user: any;
    profile: any;
    logout: () => void;
    openProfileModal: () => void;
    openAuthModal: () => void;
    openContactModal: () => void;
    closeMenu: () => void;
}

export function MobileMenu({ 
    isOpen, 
    navigationItems,
    user, 
    profile, 
    logout, 
    openProfileModal,
    openAuthModal,
    openContactModal,
    closeMenu 
}: MobileMenuProps) {
    if (!isOpen) return null;

    return (
        <div className="container absolute top-[100%] left-0 right-0 z-40 bg-white py-4 border-t border-muted">
            <div className="flex flex-col space-y-4">
                <NavigationMenuItems 
                    items={navigationItems} 
                    isMobile 
                    onItemClick={closeMenu}
                />

                <div className="pt-4 border-t border-muted">
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

                    {user ? (
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2"
                                onClick={() => {
                                    openProfileModal();
                                    closeMenu();
                                }}
                            >
                                <User size={16} />
                                Mi Perfil
                            </Button>
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
        </div>
    );
}
