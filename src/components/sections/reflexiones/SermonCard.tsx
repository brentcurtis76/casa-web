
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SermonProps {
  title: string;
  speaker: string;
  date: string;
  spotifyLink: string;
  image: string;
  description?: string;
  /** Audio autoalojado — habilita el reproductor integrado en la tarjeta. */
  audioUrl?: string;
}

export function SermonCard({ title, speaker, date, spotifyLink, image, audioUrl }: SermonProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video relative bg-muted overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Play className="text-white h-16 w-16" />
        </div>
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl line-clamp-1">{title}</CardTitle>
        <CardDescription>
          {speaker} • {date}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-col gap-2">
        {audioUrl && (
          // preload="none": no descargar megas de MP3 al cargar la portada.
          <audio controls preload="none" src={audioUrl} className="w-full">
            Tu navegador no soporta el reproductor de audio.
          </audio>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={spotifyLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
            <span>Escuchar en Spotify</span>
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
