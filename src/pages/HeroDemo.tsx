
import { Hero } from "@/components/ui/hero-with-group-of-images-text-and-two-buttons";
import { Header1 } from '@/components/ui/header';

function HeroDemo() {
  return (
    <div className="min-h-screen">
      <Header1 />
      <div className="pt-28">
        <Hero />
      </div>
    </div>
  );
}

export default HeroDemo;
