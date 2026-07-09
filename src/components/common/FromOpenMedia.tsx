import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Smartphone, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  name: string;
  description: string;
  web: string;
  apk: string;
  icon: typeof Globe | typeof Smartphone;
}

const products: Product[] = [
  {
    name: 'Sarath',
    description: 'Quick, lightweight browsing.',
    web: 'https://sarath.openflip.in/',
    apk: 'https://rjo7t2wzjhoes6ar.public.blob.vercel-storage.com/Sarath.apk',
    icon: Globe,
  },
  {
    name: 'OpenChat',
    description: 'Simple, secure messaging.',
    web: 'https://openchat.openflip.in/',
    apk: 'https://rjo7t2wzjhoes6ar.public.blob.vercel-storage.com/OpenChat.apk',
    icon: Smartphone,
  },
];

interface FromOpenMediaProps {
  className?: string;
  compact?: boolean;
}

export function FromOpenMedia({ className, compact = false }: FromOpenMediaProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3
        className={cn(
          'text-center font-semibold text-muted-foreground uppercase tracking-wide',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        From Open Media — Our Other Apps and Products
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {products.map((product) => {
          const Icon = product.icon;
          return (
            <Card
              key={product.name}
              className={cn(
                'space-y-3',
                compact ? 'p-3' : 'p-4'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={product.web} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-1" /> Web
                  </a>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <a href={product.apk} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-4 w-4 mr-1" /> APK
                  </a>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
