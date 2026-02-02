import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplyQuoteProps {
  replyTo: {
    id: string;
    content: string;
    sender_username: string;
    isMine: boolean;
  } | null;
  onClear: () => void;
  variant?: 'input' | 'message';
}

export function ReplyQuote({ replyTo, onClear, variant = 'input' }: ReplyQuoteProps) {
  if (!replyTo) return null;

  if (variant === 'message') {
    return (
      <div className={cn(
        "text-xs px-2 py-1 mb-1 rounded border-l-2 border-primary/50",
        "bg-primary/5"
      )}>
        <span className="font-medium text-primary">{replyTo.sender_username}</span>
        <p className="text-muted-foreground truncate">{replyTo.content}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-l-4 border-l-primary">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Replying to {replyTo.isMine ? 'yourself' : replyTo.sender_username}
        </p>
        <p className="text-sm text-muted-foreground truncate">{replyTo.content}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
