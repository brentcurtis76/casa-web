
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { NavbarDesktopMenu } from './navbar/NavbarDesktopMenu';
import { NavbarMobileMenu } from './navbar/NavbarMobileMenu';
import { NavbarLogo } from './navbar/NavbarLogo';
import { useNavbarScroll } from './navbar/useNavbarScroll';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile, logout } = useAuth();
  const isScrolled = useNavbarScroll();

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-white/90 backdrop-blur-md shadow-md py-3' 
            : 'bg-transparent py-5'
        }`}
      >
        <div className="container-custom flex items-center justify-between">
          <NavbarLogo />

          {/* Desktop Navigation */}
          <NavbarDesktopMenu
            user={user}
            profile={profile}
            setIsAuthModalOpen={setIsAuthModalOpen}
            logout={logout}
            getInitials={getInitials}
          />

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-foreground p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <NavbarMobileMenu
          isMenuOpen={isMenuOpen}
          user={user}
          setIsAuthModalOpen={setIsAuthModalOpen}
          setIsMenuOpen={setIsMenuOpen}
          logout={logout}
        />
      </nav>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
