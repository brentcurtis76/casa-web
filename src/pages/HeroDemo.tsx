
import { Hero } from "@/components/ui/hero-with-group-of-images-text-and-two-buttons";
import { Header1 } from '@/components/ui/header';
import { Participar } from "@/components/sections/Participar";

function HeroDemo() {
  return (
    <div className="min-h-screen">
      <Header1 />
      <div className="pt-0">
        <Hero />
        <Participar />
      </div>
    </div>
  );
}

export default HeroDemo;
