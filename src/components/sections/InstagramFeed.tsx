
import { ExternalLink, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstagramFeed() {
  // Datos de ejemplo para el feed de Instagram
  const instagramPosts = [
    { id: 1, imageUrl: "/lovable-uploads/f3a16c7c-e0d2-4471-9099-848c6533fb7a.png" },
    { id: 2, imageUrl: "/lovable-uploads/10870cef-f487-456b-8140-5c04bf8e4312.png" },
    { id: 3, imageUrl: "/lovable-uploads/4590165d-08cf-4cf7-8a81-482f0ebbf654.png" },
    { id: 4, imageUrl: "/lovable-uploads/105a46c3-8fe4-429c-af7d-79a85edc4694.png" },
    { id: 5, imageUrl: "/lovable-uploads/f29336e6-582e-4bd6-8fbf-e8fe350391e7.png" },
    { id: 6, imageUrl: "/lovable-uploads/530f4d22-998f-4e6e-a3b4-ec8c788e3098.png" }
  ];

  return (
    <section className="section bg-white">
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
              href="https://www.instagram.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center"
            >
              @iglesiacasa
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {instagramPosts.map(post => (
            <a 
              key={post.id}
              href="https://www.instagram.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="relative aspect-square bg-muted overflow-hidden group"
            >
              <img 
                src={post.imageUrl} 
                alt="Instagram post" 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-casa-800/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Instagram className="h-8 w-8 text-white" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
