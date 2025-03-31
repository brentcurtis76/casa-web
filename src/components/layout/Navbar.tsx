
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, logout } = useAuth();

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
            <span className="font-serif text-2xl font-bold text-casa-600">CASA</span>
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
              Sermones
            </a>
            <a href="#oracion" className="text-foreground hover:text-casa-500 transition">
              Oración
            </a>

            {user ? (
              <Button variant="outline" onClick={logout}>
                Cerrar Sesión
              </Button>
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
                Sermones
              </a>
              <a
                href="#oracion"
                className="text-foreground hover:text-casa-500 transition py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Oración
              </a>

              {user ? (
                <Button variant="outline" onClick={logout} className="w-full">
                  Cerrar Sesión
                </Button>
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
    </>
  );
}
