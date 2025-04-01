"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { 
    Menu, 
    MoveRight, 
    X, 
    User,
    LogOut
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Header1() {
    const { user, profile, logout } = useAuth();
    const [isOpen, setOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    
    const handleCloseProfileModal = () => {
        setIsProfileModalOpen(false);
    };

    const navigationItems = [
        {
            title: "Inicio",
            href: "/",
            description: "",
        },
        {
            title: "Nosotros",
            description: "Conoce más sobre nuestra comunidad y misión.",
            items: [
                {
                    title: "Propósito",
                    href: "/#proposito",
                },
                {
                    title: "Equipo",
                    href: "/#equipo",
                },
                {
                    title: "Participar",
                    href: "/#participar",
                },
            ],
        },
        {
            title: "Recursos",
            description: "Descubre contenido para crecer en tu fe.",
            items: [
                {
                    title: "Sermones",
                    href: "/#sermones",
                },
                {
                    title: "Eventos",
                    href: "/#eventos",
                },
                {
                    title: "Oración",
                    href: "/#oracion",
                },
                {
                    title: "Instagram",
                    href: "/#instagram",
                },
            ],
        },
    ];

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-background">
            <div className="container relative mx-auto min-h-20 flex gap-4 flex-row lg:grid lg:grid-cols-3 items-center">
                <div className="justify-start items-center gap-4 lg:flex hidden flex-row">
                    <NavigationMenu className="flex justify-start items-start">
                        <NavigationMenuList className="flex justify-start gap-4 flex-row">
                            {navigationItems.map((item) => (
                                <NavigationMenuItem key={item.title}>
                                    {item.href && !item.items ? (
                                        <>
                                            <NavigationMenuLink asChild>
                                                <Link to={item.href}>
                                                    <Button variant="ghost">{item.title}</Button>
                                                </Link>
                                            </NavigationMenuLink>
                                        </>
                                    ) : (
                                        <>
                                            <NavigationMenuTrigger className="font-medium text-sm">
                                                {item.title}
                                            </NavigationMenuTrigger>
                                            <NavigationMenuContent className="!w-[450px] p-4">
                                                <div className="flex flex-col lg:grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col h-full justify-between">
                                                        <div className="flex flex-col">
                                                            <p className="text-base">{item.title}</p>
                                                            <p className="text-muted-foreground text-sm">
                                                                {item.description}
                                                            </p>
                                                        </div>
                                                        <Button size="sm" className="mt-10">
                                                            Contactar
                                                        </Button>
                                                    </div>
                                                    <div className="flex flex-col text-sm h-full justify-end">
                                                        {item.items?.map((subItem) => (
                                                            <Link
                                                                to={subItem.href}
                                                                key={subItem.title}
                                                                className="flex flex-row justify-between items-center hover:bg-muted py-2 px-4 rounded"
                                                            >
                                                                <span>{subItem.title}</span>
                                                                <MoveRight className="w-4 h-4 text-muted-foreground" />
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            </NavigationMenuContent>
                                        </>
                                    )}
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
                <div className="flex lg:justify-center px-4">
                    <img 
                        src="/lovable-uploads/bc608912-a57b-456f-a6c5-74ffc00e8300.png" 
                        alt="CASA San Andrés" 
                        className="h-16 w-auto"
                    />
                </div>
                <div className="flex justify-end w-full gap-4 items-center">
                    <Button variant="ghost" className="hidden md:inline">
                        Contactar
                    </Button>
                    <div className="border-r hidden md:inline"></div>
                    {user ? (
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
                                <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Mi Perfil</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={logout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Cerrar Sesión</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="outline" onClick={() => setIsAuthModalOpen(true)}>
                            Iniciar Sesión
                        </Button>
                    )}
                    <Button>Participar</Button>
                </div>
                <div className="flex w-12 shrink lg:hidden items-end justify-end">
                    <Button variant="ghost" onClick={() => setOpen(!isOpen)}>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                    {isOpen && (
                        <div className="absolute top-20 border-t flex flex-col w-full right-0 bg-background shadow-lg py-4 container gap-8">
                            {navigationItems.map((item) => (
                                <div key={item.title}>
                                    <div className="flex flex-col gap-2">
                                        {item.href && !item.items ? (
                                            <Link
                                                to={item.href}
                                                className="flex justify-between items-center"
                                            >
                                                <span className="text-lg">{item.title}</span>
                                                <MoveRight className="w-4 h-4 stroke-1 text-muted-foreground" />
                                            </Link>
                                        ) : (
                                            <p className="text-lg">{item.title}</p>
                                        )}
                                        {item.items &&
                                            item.items.map((subItem) => (
                                                <Link
                                                    key={subItem.title}
                                                    to={subItem.href}
                                                    className="flex justify-between items-center"
                                                >
                                                    <span className="text-muted-foreground">
                                                        {subItem.title}
                                                    </span>
                                                    <MoveRight className="w-4 h-4 stroke-1" />
                                                </Link>
                                            ))}
                                    </div>
                                </div>
                            ))}
                            {user ? (
                                <div className="flex flex-col gap-2 mt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setIsProfileModalOpen(true);
                                            setOpen(false);
                                        }}
                                        className="w-full"
                                    >
                                        Mi Perfil
                                    </Button>
                                    <Button variant="outline" onClick={logout} className="w-full">
                                        Cerrar Sesión
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 mt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setIsAuthModalOpen(true);
                                            setOpen(false);
                                        }}
                                        className="w-full"
                                    >
                                        Iniciar Sesión
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
            
            <ProfileModal 
                isOpen={isProfileModalOpen}
                onClose={handleCloseProfileModal}
            />
        </header>
    );
}

export { Header1 };
