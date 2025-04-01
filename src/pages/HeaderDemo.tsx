
import { Header1 } from '@/components/ui/header';

const HeaderDemo = () => {
  return (
    <div className="min-h-screen">
      <Header1 />
      <div className="pt-20 container mx-auto">
        <h1 className="text-2xl font-bold mb-4">Header Demo</h1>
        <p>Esta página muestra el componente de cabecera en acción.</p>
      </div>
    </div>
  );
};

export default HeaderDemo;
