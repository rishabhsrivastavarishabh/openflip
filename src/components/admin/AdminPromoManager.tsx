import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Tag,
  Calendar, Users, Percent, IndianRupee, Loader2, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  first_time_only: boolean;
  created_at: string;
}

interface AdminPromoManagerProps {
  onBack: () => void;
}

export function AdminPromoManager({ onBack }: AdminPromoManagerProps) {
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'flat',
    discount_value: '',
    max_uses: '',
    expires_at: '',
    first_time_only: false,
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.discount_value) {
      toast.error('Please fill in required fields');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('promo_codes')
        .insert({
          code: formData.code.toUpperCase(),
          discount_type: formData.discount_type,
          discount_value: parseFloat(formData.discount_value),
          max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
          expires_at: formData.expires_at || null,
          first_time_only: formData.first_time_only,
          is_active: true,
        });

      if (error) throw error;

      toast.success('Promo code created!');
      setShowCreateDialog(false);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        max_uses: '',
        expires_at: '',
        first_time_only: false,
      });
      fetchPromoCodes();
    } catch (error: any) {
      console.error('Error creating promo code:', error);
      toast.error(error.message || 'Failed to create promo code');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setPromoCodes(prev =>
        prev.map(p => (p.id === id ? { ...p, is_active: !isActive } : p))
      );
      toast.success(isActive ? 'Promo code disabled' : 'Promo code enabled');
    } catch (error) {
      console.error('Error toggling promo code:', error);
      toast.error('Failed to update promo code');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code?')) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPromoCodes(prev => prev.filter(p => p.id !== id));
      toast.success('Promo code deleted');
    } catch (error) {
      console.error('Error deleting promo code:', error);
      toast.error('Failed to delete promo code');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Promo Codes</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg flex-1">Promo Codes</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <Tag className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold">{promoCodes.length}</p>
          <p className="text-xs text-muted-foreground">Total Codes</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <ToggleRight className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-lg font-bold">{promoCodes.filter(p => p.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-lg font-bold">{promoCodes.reduce((sum, p) => sum + p.current_uses, 0)}</p>
          <p className="text-xs text-muted-foreground">Total Uses</p>
        </div>
      </div>

      {/* Promo Codes List */}
      <div className="space-y-3">
        {promoCodes.map((promo, index) => (
          <motion.div
            key={promo.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-xl border ${
              promo.is_active ? 'bg-secondary/50' : 'bg-muted/30 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyCode(promo.code)}
                  className="font-mono text-lg font-bold hover:text-primary transition-colors flex items-center gap-1"
                >
                  {promo.code}
                  <Copy className="w-3 h-3" />
                </button>
                <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                  {promo.is_active ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleActive(promo.id, promo.is_active)}
                >
                  {promo.is_active ? (
                    <ToggleRight className="w-5 h-5 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(promo.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {promo.discount_type === 'percentage' ? (
                  <Percent className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                )}
                <span>
                  {promo.discount_type === 'percentage'
                    ? `${promo.discount_value}% off`
                    : `₹${promo.discount_value} off`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>
                  {promo.current_uses} / {promo.max_uses || '∞'} uses
                </span>
              </div>
              {promo.expires_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Expires {format(new Date(promo.expires_at), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {promo.first_time_only && (
                <Badge variant="outline" className="w-fit">First-time only</Badge>
              )}
            </div>
          </motion.div>
        ))}

        {promoCodes.length === 0 && (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No promo codes yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreateDialog(true)}
            >
              Create your first code
            </Button>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
            <DialogDescription>
              Create a new promotional discount code
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="SAVE20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="flex-1"
                />
                <Button variant="outline" onClick={generateRandomCode}>
                  Generate
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v) => setFormData({ ...formData, discount_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  placeholder={formData.discount_type === 'percentage' ? '20' : '100'}
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Uses (optional)</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date (optional)</Label>
                <Input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>First-time subscribers only</Label>
              <Switch
                checked={formData.first_time_only}
                onCheckedChange={(c) => setFormData({ ...formData, first_time_only: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
