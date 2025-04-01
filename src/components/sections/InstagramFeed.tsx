
import { useState, useEffect } from "react";
import { ExternalLink, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface InstagramPost {
  id: string;
  imageUrl: string;
  caption?: string;
  permalink: string;
  timestamp: string;
}

interface InstagramUser {
  username: string;
  accountType: string;
  mediaCount: number;
}

export function InstagramFeed() {
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([]);
  const [username, setUsername] = useState("iglesiacasa");
  const [isLoading, setIsLoading] = useState(true);

  // Datos de ejemplo para el feed de Instagram como fallback
  const fallbackPosts = [
    { id: "1", imageUrl: "/lovable-uploads/f3a16c7c-e0d2-4471-9099-848c6533fb7a.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() },
    { id: "2", imageUrl: "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() },
    { id: "3", imageUrl: "/lovable-uploads/4590165d-08cf-4cf7-8a81-482f0ebbf654.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() },
    { id: "4", imageUrl: "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() },
    { id: "5", imageUrl: "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() },
    { id: "6", imageUrl: "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png", permalink: "https://www.instagram.com", timestamp: new Date().toISOString() }
  ];

  useEffect(() => {
    const fetchInstagramPosts = async () => {
      try {
        setIsLoading(true);
        console.log('Obteniendo datos de Instagram...');
        
        // Llamar a nuestra función Edge en Supabase
        const { data, error } = await supabase.functions.invoke('instagram-feed');
        
        if (error) {
          throw new Error(`Error al llamar a la función Edge: ${error.message}`);
        }
        
        if (!data.success) {
          throw new Error(`Error en la respuesta de la función Edge: ${data.error}`);
        }
        
        console.log('Datos de Instagram obtenidos correctamente:', data);
        
        // Actualizar el estado con los datos recibidos
        setInstagramPosts(data.data.posts);
        setUsername(data.data.user.username);
        
        toast({
          title: "Feed de Instagram actualizado",
          description: "Se han cargado las publicaciones más recientes",
        });
      } catch (error) {
        console.error("Error obteniendo datos de Instagram:", error);
        
        // Usar datos de ejemplo en caso de error
        setInstagramPosts(fallbackPosts);
        
        toast({
          variant: "destructive",
          title: "Error de conexión",
          description: "No se pudo conectar con Instagram. Mostrando datos de ejemplo.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstagramPosts();
  }, []);

  return (
    <section className="section bg-white" id="instagram">
      <div className="container-custom">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Instagram className="h-6 w-6 text-casa-600 mr-3" />
            <h2 className="text-2xl md:text-3xl font-bold text-casa-700">
              Síguenos en Instagram
            </h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <a 
              href={`https://www.instagram.com/${username}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center"
            >
              @{username}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {isLoading ? (
            // Esqueletos de carga
            Array(6).fill(0).map((_, index) => (
              <div key={index} className="aspect-square bg-gray-200 animate-pulse rounded-md"></div>
            ))
          ) : (
            instagramPosts.map(post => (
              <a 
                key={post.id}
                href={post.permalink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative aspect-square bg-muted overflow-hidden group rounded-md"
              >
                <img 
                  src={post.imageUrl} 
                  alt={post.caption || "Instagram post"} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-casa-800/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Instagram className="h-8 w-8 text-white" />
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
