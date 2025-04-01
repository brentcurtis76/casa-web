
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { UserMenu } from "./header/UserMenu";
import { MobileMenu } from "./header/MobileMenu";
import { ContactModal } from "@/components/contact/ContactModal";
import { DonationModal } from "@/components/donation/DonationModal";

function Header1() {
    const { user, profile, logout } = useAuth();
    const [isOpen, setOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
    
    const handleCloseProfileModal = () => {
        setIsProfileModalOpen(false);
    };

    const toggleMenu = () => setOpen(!isOpen);
    const openProfileModal = () => setIsProfileModalOpen(true);
    const openAuthModal = () => setIsAuthModalOpen(true);
    const openContactModal = () => setIsContactModalOpen(true);
    const openDonationModal = () => setIsDonationModalOpen(true);
    const closeMenu = () => setOpen(false);

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-background">
            <div className="container relative mx-auto min-h-20 flex items-center justify-between">
                {/* Logo on the left */}
                <div className="flex items-center">
                    <img 
                        src="/lovable-uploads/bc608912-a57b-456f-a6c5-74ffc00e8300.png" 
                        alt="CASA San Andrés" 
                        className="h-16 w-auto"
                    />
                </div>
                
                {/* Action buttons on the right */}
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        className="hidden md:inline"
                        onClick={openContactModal}
                    >
                        Contactar
                    </Button>
                    
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
                    
                    <Button onClick={openDonationModal}>Haz un aporte</Button>
                    
                    {/* Mobile menu button */}
                    <Button variant="ghost" className="md:hidden" onClick={toggleMenu}>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>
                
                {/* Simplified mobile menu */}
                <MobileMenu 
                    isOpen={isOpen}
                    navigationItems={[]}
                    user={user}
                    profile={profile}
                    logout={logout}
                    openProfileModal={openProfileModal}
                    openAuthModal={openAuthModal}
                    openContactModal={openContactModal}
                    openDonationModal={openDonationModal}
                    closeMenu={closeMenu}
                />
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

            <DonationModal
                isOpen={isDonationModalOpen}
                onClose={() => setIsDonationModalOpen(false)}
            />
        </header>
    );
}

export { Header1 };
