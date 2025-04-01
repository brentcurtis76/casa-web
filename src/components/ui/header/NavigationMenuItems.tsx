
import { 
    NavigationMenu, 
    NavigationMenuContent, 
    NavigationMenuItem, 
    NavigationMenuLink, 
    NavigationMenuList, 
    NavigationMenuTrigger 
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { NavigationItem } from "./navigationData";
import { LucideIcon } from "lucide-react";

interface NavigationMenuItemsProps {
    items: NavigationItem[];
}

export function NavigationMenuItems({ items }: NavigationMenuItemsProps) {
    // Regular menu items that link directly to a URL
    const regularItems = items.filter(item => !item.subItems);
    
    // Items with dropdown submenus
    const dropdownItems = items.filter(item => item.subItems && item.subItems.length > 0);

    return (
        <NavigationMenu>
            <NavigationMenuList>
                {/* Regular Items */}
                {regularItems.map((item) => (
                    <NavigationMenuItem key={item.title}>
                        <NavigationMenuLink
                            href={item.link}
                            className={cn(
                                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                            )}
                        >
                            <div className="text-sm font-medium leading-none">{item.title}</div>
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                ))}

                {/* Dropdown Items */}
                {dropdownItems.map((item) => (
                    <NavigationMenuItem key={item.title}>
                        <NavigationMenuTrigger className="font-medium text-sm">
                            {item.title}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent className="p-4">
                            <div className="flex flex-col lg:grid grid-cols-2 gap-4">
                                <div className="flex flex-col h-full justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-base">{item.title}</p>
                                        <p className="text-muted-foreground">
                                            {item.description || "Explora nuestras opciones"}
                                        </p>
                                    </div>
                                </div>
                                <ul className="w-full grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
                                    {item.subItems?.map((subItem) => (
                                        <ListItem
                                            key={subItem.title}
                                            title={subItem.title}
                                            href={subItem.link}
                                            description={subItem.description || ""}
                                            Icon={subItem.icon}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                ))}
            </NavigationMenuList>
        </NavigationMenu>
    );
}

interface ListItemProps {
    title: string;
    href: string;
    description: string;
    Icon?: LucideIcon;
}

const ListItem = ({ title, href, description, Icon }: ListItemProps) => {
    return (
        <li>
            <NavigationMenuLink asChild>
                <a
                    href={href}
                    className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" />}
                        <div className="text-sm font-medium leading-none">{title}</div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {description}
                    </p>
                </a>
            </NavigationMenuLink>
        </li>
    );
};
