
import { Bell, Home, HelpCircle, Settings, Shield, Mail, User, FileText, Lock } from "lucide-react";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { Header1 } from '@/components/ui/header';

function DefaultDemo() {
  const tabs = [
    { title: "Dashboard", icon: Home },
    { title: "Notifications", icon: Bell },
    { type: "separator" },
    { title: "Settings", icon: Settings },
    { title: "Support", icon: HelpCircle },
    { title: "Security", icon: Shield },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ExpandableTabs tabs={tabs} />
    </div>
  );
}

function CustomColorDemo() {
  const tabs = [
    { title: "Profile", icon: User },
    { title: "Messages", icon: Mail },
    { type: "separator" },
    { title: "Documents", icon: FileText },
    { title: "Privacy", icon: Lock },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ExpandableTabs 
        tabs={tabs} 
        activeColor="text-blue-500"
        className="border-blue-200 dark:border-blue-800" 
      />
    </div>
  );
}

const ExpandableTabsDemo = () => {
  return (
    <div className="min-h-screen">
      <Header1 />
      <div className="pt-28 container mx-auto">
        <h1 className="text-2xl font-bold mb-8">Expandable Tabs Component</h1>
        
        <div className="space-y-12">
          <div>
            <h2 className="text-xl font-semibold mb-4">Default Example</h2>
            <DefaultDemo />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Custom Colors Example</h2>
            <CustomColorDemo />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpandableTabsDemo;
