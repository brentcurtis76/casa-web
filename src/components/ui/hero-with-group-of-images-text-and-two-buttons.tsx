
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function Hero() {
  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-8 items-center md:grid-cols-2">
          <div className="flex gap-4 flex-col">
            <div>
              <Badge variant="outline">We&apos;re live!</Badge>
            </div>
            <div className="flex gap-4 flex-col">
              <h1 className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-regular">
                This is the start of something!
              </h1>
              <p className="text-xl leading-relaxed tracking-tight text-muted-foreground max-w-md text-left">
                Managing a small business today is already tough. Avoid further
                complications by ditching outdated, tedious trade methods. Our
                goal is to streamline SMB trade, making it easier and faster than
                ever.
              </p>
            </div>
            <div className="flex flex-row gap-4">
              <Button size="lg" className="gap-4" variant="outline">
                Jump on a call <PhoneCall className="w-4 h-4" />
              </Button>
              <Button size="lg" className="gap-4">
                Sign up here <MoveRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                src="/lovable-uploads/bf924b41-2c5a-41f6-9774-09c75868c107.png" 
                alt="Church building with cross" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-muted rounded-md row-span-2 overflow-hidden">
              <img 
                src="/lovable-uploads/8b822767-4e31-4760-b15e-264a2086a357.png" 
                alt="Child and adult interacting" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-muted rounded-md aspect-square overflow-hidden">
              <img 
                src="/lovable-uploads/26b28f0b-f024-4f8d-98e8-52227c068246.png" 
                alt="People embracing" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
