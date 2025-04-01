
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavbarDesktopMenuProps {
  user: any;
  profile: any;
  setIsProfileModalOpen: (isOpen: boolean) => void;
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
  return (
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
  );
}
