
import { Card, CardContent } from "@/components/ui/card";

interface LeaderProps {
  name: string;
  role: string;
  imageSrc?: string;
}

function LeaderCard({ name, role, imageSrc }: LeaderProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="aspect-square relative">
        {imageSrc ? (
          <img 
            src={imageSrc} 
            alt={name} 
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-casa-100 flex items-center justify-center">
            <span className="text-4xl text-casa-500">{name.charAt(0)}</span>
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-bold text-lg">{name}</h3>
        <p className="text-muted-foreground">{role}</p>
      </CardContent>
    </Card>
  );
}

export function Equipo() {
  const pastorTeam = [
    { name: "Brent Curtis", role: "Pastor Principal", imageSrc: "/lovable-uploads/9ea1c3e6-66ec-4a6c-a94d-6eeb0f18d281.png" },
    { name: "Patricio Browne", role: "Pastor Titular" },
    { name: "Fiona Fraser", role: "Pastora" },
    { name: "Claudia Araya", role: "Pastora" },
    { name: "Arnoldo Cisternas", role: "Pastor" },
    { name: "Eugenia Riffo", role: "Administración y Finanzas" },
  ];

  const concilio = [
    { name: "Andrew Warren", role: "Miembro del Concilio" },
    { name: "Victor Córdova", role: "Miembro del Concilio" },
    { name: "Aurora Fontecilla", role: "Miembro del Concilio" },
    { name: "Anita Pinchart", role: "Miembro del Concilio" },
    { name: "Georgina García", role: "Miembro del Concilio" },
    { name: "Nevenka Echegaray", role: "Miembro del Concilio" },
    { name: "Mónica Van Gindertaelen", role: "Miembro del Concilio" },
    { name: "Melanie Sharman", role: "Miembro del Concilio" },
    { name: "Pablo Rebolledo", role: "Miembro del Concilio" },
  ];

  return (
    <section id="equipo" className="section">
      <div className="container-custom">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-casa-700 mb-8">
          Equipo y Liderazgo
        </h2>
        <p className="text-lg text-center max-w-3xl mx-auto mb-12">
          El acompañamiento espiritual de nuestra CASA reside en su apasionado Equipo Pastoral y el Concilio, quienes dedican su energía y amor para asegurar que CASA sea un hogar inclusivo, acogedor y en constante evolución.
        </p>
        
        <div className="mb-12">
          <h3 className="text-2xl font-semibold mb-6 text-casa-600">Equipo Pastoral</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {pastorTeam.map((leader) => (
              <LeaderCard 
                key={leader.name} 
                name={leader.name} 
                role={leader.role}
                imageSrc={leader.imageSrc}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-6 text-casa-600">Concilio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
            {concilio.map((leader) => (
              <LeaderCard 
                key={leader.name} 
                name={leader.name} 
                role={leader.role}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
