
import React from 'react';
import { Link } from "react-router-dom";
import { MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

interface NavigationItem {
    title: string;
    href?: string;
    description?: string;
    items?: {
        title: string;
        href: string;
    }[];
}

interface NavigationMenuItemsProps {
    items: NavigationItem[];
    isMobile?: boolean;
    onItemClick?: () => void;
}

export function NavigationMenuItems({ items, isMobile = false, onItemClick }: NavigationMenuItemsProps) {
    if (isMobile) {
        return (
            <>
                {items.map((item) => (
                    <div key={item.title}>
                        <div className="flex flex-col gap-2">
                            {item.href && !item.items ? (
                                <Link
                                    to={item.href}
                                    className="flex justify-between items-center"
                                    onClick={onItemClick}
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
                                        onClick={onItemClick}
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
            </>
        );
    }

    return (
        <NavigationMenu className="flex justify-start items-start">
            <NavigationMenuList className="flex justify-start gap-4 flex-row">
                {items.map((item) => (
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
    );
}
