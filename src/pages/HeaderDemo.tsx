
import { Header1 } from "@/components/ui/header";

function HeaderDemo() {
  return (
    <div className="block min-h-screen pt-24">
      <Header1 />
      <div className="container mx-auto mt-20">
        <h1 className="text-3xl font-bold">Header Demo Page</h1>
        <p className="mt-4">This page demonstrates the Header1 component.</p>
      </div>
    </div>
  );
}

export default HeaderDemo;
