
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup' | 'forgot-password';
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [activeView, setActiveView] = useState<'login' | 'signup' | 'forgot-password'>(defaultTab);

  const handleLoginSuccess = () => {
    onClose();
  };

  const handleSignupSuccess = () => {
    onClose();
  };

  const handleForgotPassword = () => {
    setActiveView('forgot-password');
  };

  const handleBackToLogin = () => {
    setActiveView('login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-serif">
            {activeView === 'login' && 'INICIAR SESION'}
            {activeView === 'signup' && 'CREAR CUENTA'}
            {activeView === 'forgot-password' && 'RECUPERAR CONTRASEÑA'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {activeView === 'login' && 'Ingresa a tu cuenta para enviar peticiones de oración'}
            {activeView === 'signup' && 'Crea una cuenta para ser parte de nuestra comunidad'}
            {activeView === 'forgot-password' && 'Te ayudaremos a recuperar tu contraseña'}
          </DialogDescription>
        </DialogHeader>

        {activeView === 'forgot-password' ? (
          <ForgotPasswordForm onBack={handleBackToLogin} />
        ) : (
          <Tabs
            defaultValue={activeView}
            value={activeView}
            onValueChange={(v) => setActiveView(v as 'login' | 'signup')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">INICIAR SESION</TabsTrigger>
              <TabsTrigger value="signup">REGISTRARSE</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                onForgotPassword={handleForgotPassword}
              />
            </TabsContent>
            <TabsContent value="signup">
              <SignupForm onSignupSuccess={handleSignupSuccess} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
