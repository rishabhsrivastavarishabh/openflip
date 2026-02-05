 import { motion } from 'framer-motion';
 import { cn } from '@/lib/utils';
 
 interface LoadingSpinnerProps {
   size?: 'sm' | 'md' | 'lg';
   className?: string;
   text?: string;
 }
 
 export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
   const dotSize = size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
   const gap = size === 'sm' ? 'gap-1' : size === 'lg' ? 'gap-3' : 'gap-2';
 
   return (
     <div className={cn('flex flex-col items-center justify-center', className)}>
       <div className={cn('flex items-center', gap)}>
         {[0, 1, 2].map((index) => (
           <motion.div
             key={index}
             className={cn(
               dotSize,
               'rounded-full bg-gradient-to-r from-primary via-accent to-primary'
             )}
             animate={{
               y: [0, -8, 0],
               scale: [1, 1.2, 1],
               opacity: [0.6, 1, 0.6],
             }}
             transition={{
               duration: 0.6,
               repeat: Infinity,
               delay: index * 0.15,
               ease: 'easeInOut',
             }}
           />
         ))}
       </div>
       {text && (
         <motion.p
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="mt-3 text-sm text-muted-foreground"
         >
           {text}
         </motion.p>
       )}
     </div>
   );
 }
 
 export function FullPageLoader({ text }: { text?: string }) {
   return (
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
       className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
     >
       <LoadingSpinner size="lg" text={text} />
     </motion.div>
   );
 }
 
 export function InlineLoader({ className }: { className?: string }) {
   return (
     <div className={cn('flex items-center justify-center py-8', className)}>
       <LoadingSpinner size="md" />
     </div>
   );
 }