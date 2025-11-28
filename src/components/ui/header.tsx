
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Menu, X, Home } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu } from "./header/UserMenu";
import { MobileMenu } from "./header/MobileMenu";
import { ContactModal } from "@/components/contact/ContactModal";
import { DonationModal } from "@/components/donation/DonationModal";
import { useLocation, Link } from "react-router-dom";

function Header1() {
    const { user, profile, logout } = useAuth();
    const location = useLocation();
    const [isOpen, setOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

    const toggleMenu = () => setOpen(!isOpen);
    const openAuthModal = () => setIsAuthModalOpen(true);
    const openContactModal = () => setIsContactModalOpen(true);
    const openDonationModal = () => setIsDonationModalOpen(true);
    const closeMenu = () => setOpen(false);

    const isHomePage = location.pathname === '/';

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-background">
            <div className="container relative mx-auto min-h-20 flex items-center justify-between">
                {/* Home button - only shows when not on home page */}
                {!isHomePage && (
                    <Link to="/">
                        <Button variant="ghost" size="icon" className="mr-2">
                            <Home className="h-5 w-5" />
                        </Button>
                    </Link>
                )}

                {/* Action buttons on the right */}
                <div className="flex items-center gap-4 w-full justify-end">
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

