
import { useState, useEffect } from 'react';
import { Menu, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { user, profile, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          <a href="#" className="flex items-center">
            <img 
              src="/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png" 
              alt="CASA Logo" 
              className="h-12 w-auto"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <a href="#proposito" className="text-foreground hover:text-casa-500 transition">
              Sentido & Propósito
            </a>
            <a href="#equipo" className="text-foreground hover:text-casa-500 transition">
              Equipo
            </a>
            <a href="#participar" className="text-foreground hover:text-casa-500 transition">
              Participar
            </a>
            <a href="#eventos" className="text-foreground hover:text-casa-500 transition">
              Eventos
            </a>
            <a href="#sermones" className="text-foreground hover:text-casa-500 transition">
              Reflexiones
            </a>
            <a href="#oracion" className="text-foreground hover:text-casa-500 transition">
              Oración
            </a>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full p-0 h-10 w-10 overflow-hidden">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Usuario"} />
                      <AvatarFallback>{getInitials(profile?.full_name || "Usuario")}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
                    Mi Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => setIsAuthModalOpen(true)}>
                Iniciar Sesión
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden text-foreground p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden bg-background border-t mt-2 py-4">
            <div className="container-custom flex flex-col space-y-4">
              <a
                href="#proposito"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Sentido & Propósito
              </a>
              <a
                href="#equipo"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Equipo
              </a>
              <a
                href="#participar"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Participar
              </a>
              <a
                href="#eventos"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Eventos
              </a>
              <a
                href="#sermones"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Reflexiones
              </a>
              <a
                href="#oracion"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Oración
              </a>

              {user ? (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => {
                      setIsProfileModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <User size={16} />
                    Mi Perfil
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={logout} 
                    className="w-full"
                  >
                    Cerrar Sesión
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => {
                    setIsAuthModalOpen(true);
                    setIsMenuOpen(false);
                  }} 
                  className="w-full"
                >
                  Iniciar Sesión
                </Button>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}
