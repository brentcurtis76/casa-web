
import React from 'react';
import { Button } from "@/components/ui/button";
import { NavigationMenuItems } from "./NavigationMenuItems";
import { UserMenu } from "./UserMenu";

interface MobileMenuProps {
    isOpen: boolean;
    navigationItems: any[];
    user: any;
    profile: any;
    logout: () => void;
    openProfileModal: () => void;
    openAuthModal: () => void;
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
    closeMenu
}: MobileMenuProps) {
    if (!isOpen) return null;

    const handleProfileClick = () => {
        openProfileModal();
        closeMenu();
    };

    const handleAuthClick = () => {
        openAuthModal();
        closeMenu();
    };

    return (
        <div className="absolute top-20 border-t flex flex-col w-full right-0 bg-background shadow-lg py-4 container gap-8">
            <NavigationMenuItems 
                items={navigationItems} 
                isMobile={true} 
                onItemClick={closeMenu}
            />
            
            {user ? (
                <UserMenu 
                    user={user} 
                    profile={profile} 
                    logout={logout} 
                    openProfileModal={handleProfileClick} 
                    isMobile={true} 
                />
            ) : (
                <div className="flex flex-col gap-2 mt-4">
                    <Button 
                        variant="outline" 
                        onClick={handleAuthClick}
                        className="w-full"
                    >
                        Iniciar Sesión
                    </Button>
                </div>
            )}
        </div>
    );
}
