import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">Choose how Openflip looks to you.</p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-colors',
                active ? 'border-primary bg-primary/10' : 'hover:bg-secondary',
              )}
            >
              <Icon className={cn('w-6 h-6', active && 'text-primary')} />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
