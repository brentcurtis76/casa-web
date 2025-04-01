
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { NavigationMenuItems } from "./header/NavigationMenuItems";
import { UserMenu } from "./header/UserMenu";
import { MobileMenu } from "./header/MobileMenu";
import { navigationItems } from "./header/navigationData";
import { ContactModal } from "@/components/contact/ContactModal";

function Header1() {
    const { user, profile, logout } = useAuth();
    const [isOpen, setOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    
    const handleCloseProfileModal = () => {
        setIsProfileModalOpen(false);
    };

    const toggleMenu = () => setOpen(!isOpen);
    const openProfileModal = () => setIsProfileModalOpen(true);
    const openAuthModal = () => setIsAuthModalOpen(true);
    const openContactModal = () => setIsContactModalOpen(true);
    const closeMenu = () => setOpen(false);

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-background">
            <div className="container relative mx-auto min-h-20 flex gap-4 flex-row lg:grid lg:grid-cols-3 items-center">
                <div className="justify-start items-center gap-4 lg:flex hidden flex-row">
                    <NavigationMenuItems items={navigationItems} />
                </div>
                
                <div className="flex lg:justify-center px-4">
                    <img 
                        src="/lovable-uploads/bc608912-a57b-456f-a6c5-74ffc00e8300.png" 
                        alt="CASA San Andrés" 
                        className="h-16 w-auto"
                    />
                </div>
                
                <div className="flex justify-end w-full gap-4 items-center">
                    <Button 
                        variant="ghost" 
                        className="hidden md:inline"
                        onClick={openContactModal}
                    >
                        Contactar
                    </Button>
                    <div className="border-r hidden md:inline"></div>
                    
                    {user ? (
                        <UserMenu 
                            user={user} 
                            profile={profile} 
                            logout={logout} 
                            openProfileModal={openProfileModal} 
                        />
                    ) : (
                        <Button variant="outline" onClick={openAuthModal}>
                            Iniciar Sesión
                        </Button>
                    )}
                    
                    <Button>Participar</Button>
                </div>
                
                <div className="flex w-12 shrink lg:hidden items-end justify-end">
                    <Button variant="ghost" onClick={toggleMenu}>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                    
                    <MobileMenu 
                        isOpen={isOpen}
                        navigationItems={navigationItems}
                        user={user}
                        profile={profile}
                        logout={logout}
                        openProfileModal={openProfileModal}
                        openAuthModal={openAuthModal}
                        openContactModal={openContactModal}
                        closeMenu={closeMenu}
                    />
                </div>
            </div>
            
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
            
            <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={handleCloseProfileModal}
            />

            <ContactModal
                isOpen={isContactModalOpen}
                onClose={() => setIsContactModalOpen(false)}
            />
        </header>
    );
}

export { Header1 };
