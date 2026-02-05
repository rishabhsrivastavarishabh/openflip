 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import {
   ArrowLeft, CreditCard, Building2, Smartphone,
   Check, AlertCircle, Loader2, QrCode, Tag, X
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { LoadingSpinner } from '@/components/ui/loading-spinner';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 
 interface PaymentCheckoutProps {
   amount: number;
   description: string;
   type: 'subscription' | 'boost';
   metadata?: Record<string, string>;
   priceId?: string;
   onSuccess?: () => void;
   onCancel?: () => void;
 }
 
 const BANKS = [
   { id: 'sbi', name: 'State Bank of India' },
   { id: 'hdfc', name: 'HDFC Bank' },
   { id: 'icici', name: 'ICICI Bank' },
   { id: 'axis', name: 'Axis Bank' },
   { id: 'kotak', name: 'Kotak Mahindra Bank' },
   { id: 'pnb', name: 'Punjab National Bank' },
   { id: 'bob', name: 'Bank of Baroda' },
   { id: 'canara', name: 'Canara Bank' },
 ];
 
 const UPI_APPS = [
   { id: 'gpay', name: 'Google Pay', icon: '💳' },
   { id: 'phonepe', name: 'PhonePe', icon: '📱' },
   { id: 'paytm', name: 'Paytm', icon: '💰' },
   { id: 'bhim', name: 'BHIM', icon: '🏛️' },
 ];
 
 export function PaymentCheckout({
   amount,
   description,
   type,
   metadata,
   priceId,
   onSuccess,
   onCancel,
 }: PaymentCheckoutProps) {
   const [loading, setLoading] = useState(false);
   const [paymentMethod, setPaymentMethod] = useState<'upi' | 'netbanking' | 'card'>('upi');
   const [promoCode, setPromoCode] = useState('');
   const [promoResult, setPromoResult] = useState<{
     valid: boolean;
     discount_amount?: number;
     final_price?: number;
     error?: string;
   } | null>(null);
   const [promoLoading, setPromoLoading] = useState(false);
   const [selectedBank, setSelectedBank] = useState('');
   const [upiId, setUpiId] = useState('');
   const [paymentSuccess, setPaymentSuccess] = useState(false);
 
   const displayAmount = promoResult?.valid && promoResult.final_price !== undefined
     ? promoResult.final_price
     : amount;
 
   const gst = Math.round(displayAmount * 0.18);
   const totalAmount = displayAmount + gst;
 
   const validatePromo = async () => {
     if (!promoCode.trim()) return;
     setPromoLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('validate-promo', {
         body: { promoCode: promoCode.trim(), planPrice: amount },
       });
       if (error) throw error;
       setPromoResult(data);
       if (data.valid) {
         toast.success(`Promo applied! You save ₹${data.discount_amount}`);
       } else {
         toast.error(data.error || 'Invalid promo code');
       }
     } catch (error) {
       toast.error('Failed to validate promo');
     } finally {
       setPromoLoading(false);
     }
   };
 
   const handlePayment = async () => {
     setLoading(true);
     try {
       if (type === 'subscription' && priceId) {
         const { data, error } = await supabase.functions.invoke('create-checkout', {
           body: {
             priceId,
             promoCode: promoResult?.valid ? promoCode.trim() : undefined,
           },
         });
         if (error) throw error;
         if (data?.url) {
           window.open(data.url, '_blank');
           onSuccess?.();
         }
       } else if (type === 'boost') {
         const { data, error } = await supabase.functions.invoke('create-boost-payment', {
           body: {
             amount: totalAmount,
             metadata,
             promoCode: promoResult?.valid ? promoCode.trim() : undefined,
           },
         });
         if (error) throw error;
         if (data?.url) {
           window.open(data.url, '_blank');
           setTimeout(() => {
             setPaymentSuccess(true);
             onSuccess?.();
           }, 2000);
         }
       }
     } catch (error: any) {
       toast.error(error.message || 'Payment failed. Please try again.');
     } finally {
       setLoading(false);
     }
   };
 
   if (paymentSuccess) {
     return (
       <motion.div
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         className="flex flex-col items-center justify-center py-12 space-y-4"
       >
         <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
           className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center"
         >
           <Check className="w-10 h-10 text-green-500" />
         </motion.div>
         <h2 className="text-xl font-semibold">Payment Successful!</h2>
         <p className="text-muted-foreground text-center">
           Your payment has been processed successfully.
         </p>
         <Button onClick={onSuccess} className="mt-4">
           Continue
         </Button>
       </motion.div>
     );
   }
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           {onCancel && (
             <Button variant="ghost" size="icon" onClick={onCancel}>
               <ArrowLeft className="w-5 h-5" />
             </Button>
           )}
           <div>
             <h2 className="font-semibold text-lg">Secure Checkout</h2>
             <p className="text-sm text-muted-foreground">{description}</p>
           </div>
         </div>
         {onCancel && (
           <Button variant="ghost" size="icon" onClick={onCancel}>
             <X className="w-5 h-5" />
           </Button>
         )}
       </div>
 
       {/* Amount Summary */}
       <motion.div
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20"
       >
         <div className="space-y-2">
           <div className="flex justify-between text-sm">
             <span className="text-muted-foreground">Subtotal</span>
             <span>₹{displayAmount}</span>
           </div>
           {promoResult?.valid && (
             <div className="flex justify-between text-sm text-green-500">
               <span className="flex items-center gap-1">
                 <Tag className="w-3 h-3" />
                 Discount
               </span>
               <span>-₹{promoResult.discount_amount}</span>
             </div>
           )}
           <div className="flex justify-between text-sm">
             <span className="text-muted-foreground">GST (18%)</span>
             <span>₹{gst}</span>
           </div>
           <div className="h-px bg-border my-2" />
           <div className="flex justify-between font-bold text-lg">
             <span>Total</span>
             <span className="text-primary">₹{totalAmount}</span>
           </div>
         </div>
       </motion.div>
 
       {/* Promo Code */}
       <div className="space-y-2">
         <Label>Promo Code</Label>
         <div className="flex gap-2">
           <Input
             placeholder="Enter code"
             value={promoCode}
             onChange={(e) => {
               setPromoCode(e.target.value.toUpperCase());
               setPromoResult(null);
             }}
           />
           <Button
             variant="outline"
             onClick={validatePromo}
             disabled={promoLoading || !promoCode.trim()}
           >
             {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
           </Button>
         </div>
         {promoResult && !promoResult.valid && (
           <p className="text-xs text-destructive">{promoResult.error}</p>
         )}
       </div>
 
       {/* Payment Methods */}
       <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
         <TabsList className="grid grid-cols-3 w-full">
           <TabsTrigger value="upi" className="flex items-center gap-1">
             <Smartphone className="w-4 h-4" />
             UPI
           </TabsTrigger>
           <TabsTrigger value="netbanking" className="flex items-center gap-1">
             <Building2 className="w-4 h-4" />
             Bank
           </TabsTrigger>
           <TabsTrigger value="card" className="flex items-center gap-1">
             <CreditCard className="w-4 h-4" />
             Card
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="upi" className="space-y-4 mt-4">
           {/* QR Code */}
           <div className="flex flex-col items-center p-6 rounded-xl bg-secondary/50">
             <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center mb-4">
               <QrCode className="w-32 h-32 text-foreground/80" />
             </div>
             <p className="text-sm text-muted-foreground text-center">
               Scan with any UPI app to pay
             </p>
           </div>
 
           <div className="relative">
             <div className="absolute inset-0 flex items-center">
               <div className="w-full border-t" />
             </div>
             <div className="relative flex justify-center text-xs uppercase">
               <span className="bg-background px-2 text-muted-foreground">or pay with</span>
             </div>
           </div>
 
           {/* UPI Apps */}
           <div className="grid grid-cols-4 gap-2">
             {UPI_APPS.map((app) => (
               <button
                 key={app.id}
                 onClick={handlePayment}
                 className="flex flex-col items-center p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
               >
                 <span className="text-2xl mb-1">{app.icon}</span>
                 <span className="text-xs">{app.name}</span>
               </button>
             ))}
           </div>
 
           {/* UPI ID */}
           <div className="space-y-2">
             <Label>Or enter UPI ID</Label>
             <Input
               placeholder="yourname@upi"
               value={upiId}
               onChange={(e) => setUpiId(e.target.value)}
             />
           </div>
         </TabsContent>
 
         <TabsContent value="netbanking" className="space-y-4 mt-4">
           <div className="space-y-2">
             <Label>Select Bank</Label>
             <Select value={selectedBank} onValueChange={setSelectedBank}>
               <SelectTrigger>
                 <SelectValue placeholder="Choose your bank" />
               </SelectTrigger>
               <SelectContent>
                 {BANKS.map((bank) => (
                   <SelectItem key={bank.id} value={bank.id}>
                     {bank.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <p className="text-xs text-muted-foreground">
             You will be redirected to your bank's secure page to complete the payment.
           </p>
         </TabsContent>
 
         <TabsContent value="card" className="space-y-4 mt-4">
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Card Number</Label>
               <Input placeholder="1234 5678 9012 3456" />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-2">
                 <Label>Expiry Date</Label>
                 <Input placeholder="MM/YY" />
               </div>
               <div className="space-y-2">
                 <Label>CVV</Label>
                 <Input placeholder="123" type="password" />
               </div>
             </div>
             <div className="space-y-2">
               <Label>Cardholder Name</Label>
               <Input placeholder="Name on card" />
             </div>
           </div>
         </TabsContent>
       </Tabs>
 
       {/* Pay Button */}
       <Button
         onClick={handlePayment}
         disabled={loading}
         className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
         size="lg"
       >
         {loading ? (
           <LoadingSpinner size="sm" />
         ) : (
           <>Pay ₹{totalAmount}</>
         )}
       </Button>
 
       {/* Security */}
       <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
         <span>🔒 256-bit SSL Encryption</span>
         <span>•</span>
         <span>PCI DSS Compliant</span>
       </div>
     </div>
   );
 }