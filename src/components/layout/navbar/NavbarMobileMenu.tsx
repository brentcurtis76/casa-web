
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavbarMobileMenuProps {
  isMenuOpen: boolean;
  user: any;
  setIsProfileModalOpen: (isOpen: boolean) => void;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  setIsMenuOpen: (isOpen: boolean) => void;
  logout: () => void;
}

export function NavbarMobileMenu({ 
  isMenuOpen, 
  user, 
  setIsProfileModalOpen, 
  setIsAuthModalOpen, 
  setIsMenuOpen,
  logout 
}: NavbarMobileMenuProps) {
  if (!isMenuOpen) return null;

  return (
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
  );
}
