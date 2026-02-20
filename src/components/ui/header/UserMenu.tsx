
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth/AuthContext";

interface UserMenuProps {
    user: any;
    profile: any;
    logout: () => void;
    isMobile?: boolean;
}

export function UserMenu({ user, profile, logout, isMobile = false }: UserMenuProps) {
    const navigate = useNavigate();
    const { roles } = useAuth();
    const hasAdminAccess = roles.length > 0;

    if (isMobile) {
        return (
            <div className="flex flex-col gap-2 mt-4">
                <Button
                    variant="outline"
                    onClick={() => navigate('/profile')}
                    className="w-full"
                >
                    <User className="mr-2 h-4 w-4" />
                    Mi Perfil
                </Button>
                {hasAdminAccess && (
                    <Button
                        variant="outline"
                        onClick={() => navigate('/admin')}
                        className="w-full"
                    >
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Panel de Administración
                    </Button>
                )}
                <Button variant="outline" onClick={logout} className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                </Button>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback>{profile?.full_name?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Mi Perfil</span>
                </DropdownMenuItem>
                {hasAdminAccess && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Panel de Administración</span>
                        </DropdownMenuItem>
                    </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
