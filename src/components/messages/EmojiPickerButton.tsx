import { useState } from 'react';
import { Smile } from 'lucide-react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/hooks/useTheme';

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
}

export function EmojiPickerButton({ onSelect, disabled, align = 'start' }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const resolved = theme === 'dark' ? Theme.DARK : theme === 'light' ? Theme.LIGHT : Theme.AUTO;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="shrink-0"
          aria-label="Insert emoji"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-0" align={align} side="top">
        <EmojiPicker
          theme={resolved}
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceholder="Search emoji"
          width={320}
          height={380}
          previewConfig={{ showPreview: false }}
          onEmojiClick={(e) => {
            onSelect(e.emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
