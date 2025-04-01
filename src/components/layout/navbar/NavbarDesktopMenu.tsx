
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface NavbarDesktopMenuProps {
  user: any;
  profile: any;
  setIsProfileModalOpen: () => void;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  logout: () => void;
  getInitials: (name: string) => string;
}

export function NavbarDesktopMenu({ 
  user, 
  profile, 
  setIsProfileModalOpen, 
  setIsAuthModalOpen, 
  logout,
  getInitials
}: NavbarDesktopMenuProps) {
  const handleNavigation = (href: string, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (href.includes('#')) {
      const id = href.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.location.href = href;
    }
  };

  return (
    <div className="hidden lg:flex items-center space-x-8">
      <a 
        href="#proposito" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#proposito', e)}
      >
        Sentido & Propósito
      </a>
      <a 
        href="#equipo" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#equipo', e)}
      >
        Equipo
      </a>
      <a 
        href="#participar" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#participar', e)}
      >
        Participar
      </a>
      <a 
        href="#eventos" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#eventos', e)}
      >
        Eventos
      </a>
      <a 
        href="#sermones" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#sermones', e)}
      >
        Reflexiones
      </a>
      <a 
        href="#oracion" 
        className="text-foreground hover:text-casa-500 transition"
        onClick={(e) => handleNavigation('#oracion', e)}
      >
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
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center p-2">
              <Avatar className="h-10 w-10 mr-2">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || "Usuario"} />
                <AvatarFallback>{getInitials(profile?.full_name || "Usuario")}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium truncate max-w-[180px]">
                  {profile?.full_name || "Usuario"}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={setIsProfileModalOpen}>
              <User className="mr-2 h-4 w-4" />
              Mi Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
  );
}
