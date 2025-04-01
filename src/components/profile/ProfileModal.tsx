
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-serif">Mi Perfil</DialogTitle>
          <DialogDescription className="text-center">
            Actualiza tu información y foto de perfil
          </DialogDescription>
        </DialogHeader>
        <UserProfile />
      </DialogContent>
    </Dialog>
  );
}
