
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactForm } from './ContactForm';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-serif tracking-normal">
            Contáctanos
          </DialogTitle>
          <DialogDescription className="text-center">
            Completa el formulario y nos pondremos en contacto contigo pronto.
          </DialogDescription>
        </DialogHeader>
        <ContactForm onSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}
