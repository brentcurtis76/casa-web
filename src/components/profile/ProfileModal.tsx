
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
  const handleDialogChange = (open: boolean) => {
    if (!open) {
      // Force page reload when modal closes via any method
      window.location.reload();
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={handleDialogChange}
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
