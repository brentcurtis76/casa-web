
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, Calendar, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface UserMenuProps {
    user: any;
    profile: any;
    logout: () => void;
    isMobile?: boolean;
}

export function UserMenu({ user, profile, logout, isMobile = false }: UserMenuProps) {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (!user) return;

            const { data, error } = await supabase
                .from('mesa_abierta_admin_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            if (data && !error) {
                setIsAdmin(true);
            }
        };

        checkAdminStatus();
    }, [user]);

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
                {isAdmin && (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/events')}
                            className="w-full"
                        >
                            <Calendar className="mr-2 h-4 w-4" />
                            Admin Eventos
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate('/mesa-abierta/admin')}
                            className="w-full"
                        >
                            <UtensilsCrossed className="mr-2 h-4 w-4" />
                            Admin Mesa Abierta
                        </Button>
                    </>
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
                {isAdmin && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Administración
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigate('/admin/events')}>
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>Eventos</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/mesa-abierta/admin')}>
                            <UtensilsCrossed className="mr-2 h-4 w-4" />
                            <span>Mesa Abierta</span>
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
