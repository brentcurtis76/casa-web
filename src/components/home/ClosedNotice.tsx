import { Button } from '@/components/ui/button';
import { CalendarClock } from 'lucide-react';

interface ClosedNoticeProps {
  message: string;
  onClose: () => void;
}

export function ClosedNotice({ message, onClose }: ClosedNoticeProps) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
        <CalendarClock size={26} />
      </div>
      <p className="text-base text-casa-700 leading-relaxed max-w-sm">
        {message}
      </p>
      <Button
        variant="outline"
        onClick={onClose}
        className="border-amber-300 text-amber-800 hover:bg-amber-50"
      >
        Cerrar
      </Button>
    </div>
  );
}
