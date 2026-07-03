import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Heart, Loader2 } from 'lucide-react';
import { PaymentCheckout } from '@/components/payment/PaymentCheckout';

interface TipDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creatorId: string;
  creatorName: string;
}

const PRESET_AMOUNTS = [49, 99, 199, 499];

export function TipDialog({ open, onOpenChange, creatorId, creatorName }: TipDialogProps) {
  const [step, setStep] = useState<'amount' | 'pay'>('amount');
  const [amount, setAmount] = useState<number>(99);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');

  const reset = () => { setStep('amount'); setAmount(99); setCustomAmount(''); setMessage(''); };

  const finalAmount = customAmount ? Math.max(1, Number(customAmount) || 0) : amount;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        {step === 'amount' && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-pink-500/15 flex items-center justify-center mb-2">
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
              </div>
              <DialogTitle>Send a tip to @{creatorName}</DialogTitle>
              <DialogDescription>Support creators you love. 100% via Razorpay in INR.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-2 block">Choose amount</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map(a => (
                    <Button
                      key={a}
                      variant={!customAmount && amount === a ? 'gradient' : 'outline'}
                      size="sm"
                      onClick={() => { setAmount(a); setCustomAmount(''); }}
                    >
                      ₹{a}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Or custom amount</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="₹"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-2 block">Message (optional)</Label>
                <Textarea
                  placeholder="Say something nice..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                  rows={2}
                />
              </div>

              <Button
                variant="gradient"
                className="w-full"
                onClick={() => setStep('pay')}
                disabled={finalAmount < 1}
              >
                Continue · ₹{finalAmount}
              </Button>
            </div>
          </>
        )}

        {step === 'pay' && (
          <PaymentCheckout
            amount={finalAmount}
            description={`Tip to @${creatorName}`}
            type={'tip' as any}
            metadata={{ creator_id: creatorId, message: message.slice(0, 200) }}
            onSuccess={() => { reset(); onOpenChange(false); }}
            onCancel={() => setStep('amount')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
