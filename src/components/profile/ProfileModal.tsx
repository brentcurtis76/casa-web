
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserProfile } from "./UserProfile";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          // Force a small delay to ensure React state updates properly
          setTimeout(() => {
            onClose();
          }, 10);
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-serif">Mi Perfil</DialogTitle>
          <DialogDescription className="text-center">
            Actualiza tu información
          </DialogDescription>
        </DialogHeader>
        <UserProfile onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
