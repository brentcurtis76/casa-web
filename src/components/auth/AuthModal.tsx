
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab);

  const handleLoginSuccess = () => {
    onClose();
  };

  const handleSignupSuccess = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-serif">
            {activeTab === 'login' ? 'INICIAR SESION' : 'CREAR CUENTA'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {activeTab === 'login'
              ? 'Ingresa a tu cuenta para enviar peticiones de oración'
              : 'Crea una cuenta para ser parte de nuestra comunidad'}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">INICIAR SESION</TabsTrigger>
            <TabsTrigger value="signup">REGISTRARSE</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onLoginSuccess={handleLoginSuccess} />
          </TabsContent>
          <TabsContent value="signup">
            <SignupForm onSignupSuccess={handleSignupSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
