
import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold text-casa-700">Haz un aporte</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Nuestra CASA se sostiene con los aportes de toda la comunidad. Te invitamos a programar una transferencia mensual, por pequeña que sea, para ayudar. Todo suma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="bg-casa-50 p-4 rounded-lg">
            <h3 className="font-medium text-casa-700 mb-2">Datos de cuenta corriente:</h3>
            <ul className="space-y-2 text-casa-600">
              <li><span className="font-medium">Nombre:</span> Corporación Anglicana de Chile</li>
              <li><span className="font-medium">Rut:</span> 70.043.500-8</li>
              <li><span className="font-medium">Banco:</span> Santander</li>
              <li><span className="font-medium">Cuenta:</span> 73922194</li>
              <li><span className="font-medium">Email:</span> eriffocontreras@gmail.com</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <Button onClick={onClose} variant="outline">Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
