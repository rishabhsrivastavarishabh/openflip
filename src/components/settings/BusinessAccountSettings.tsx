import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Briefcase, Mail, Globe, BadgeCheck, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BusinessAccountSettingsProps {
  onBack: () => void;
}

const businessCategories = [
  'Creator',
  'Artist',
  'Musician',
  'Blogger',
  'Brand',
  'Shop',
  'Service Provider',
  'Public Figure',
  'Media/News',
  'Sports',
  'Gaming',
  'Other',
];

export function BusinessAccountSettings({ onBack }: BusinessAccountSettingsProps) {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  
  const [formData, setFormData] = useState({
    account_type: (profile as any)?.account_type || 'personal',
    business_category: (profile as any)?.business_category || '',
    business_email: (profile as any)?.business_email || '',
    business_website: (profile as any)?.business_website || '',
  });

  const [verificationNotes, setVerificationNotes] = useState('');

  const isBusinessAccount = formData.account_type === 'business';
  const isVerified = profile?.is_verified;
  const verificationStatus = (profile as any)?.verification_status || 'none';

  const handleSwitchAccountType = async (type: string) => {
    setLoading(true);
    const updates: Record<string, any> = { 
      account_type: type,
      ...(type === 'personal' ? {
        business_category: null,
        business_email: null,
        business_website: null,
      } : {})
    };
    
    setFormData(prev => ({ ...prev, account_type: type }));
    
    const { error } = await (updateProfile as any)(updates);
    
    if (error) {
      toast.error('Failed to update account type');
    } else {
      toast.success(type === 'business' ? 'Switched to Business Account' : 'Switched to Personal Account');
    }
    setLoading(false);
  };

  const handleSaveBusinessInfo = async () => {
    setLoading(true);
    
    const { error } = await (updateProfile as any)({
      business_category: formData.business_category || null,
      business_email: formData.business_email || null,
      business_website: formData.business_website || null,
    });

    if (error) {
      toast.error('Failed to save business info');
    } else {
      toast.success('Business info saved');
    }
    setLoading(false);
  };

  const handleRequestVerification = async () => {
    if (!user || !formData.business_category) {
      toast.error('Please select a category first');
      return;
    }

    setRequestingVerification(true);
    
    try {
      // Create verification request
      await (supabase as any).from('verification_requests').insert({
        user_id: user.id,
        category: formData.business_category,
        business_name: profile?.full_name || profile?.username,
        business_email: formData.business_email,
        notes: verificationNotes,
      });

      // Update profile
      await (updateProfile as any)({
        verification_status: 'pending',
        verification_requested_at: new Date().toISOString(),
      });

      // Create notification for admins (would be handled by trigger in production)
      toast.success('Verification request submitted!');
      setShowVerificationForm(false);
    } catch (error) {
      console.error('Error requesting verification:', error);
      toast.error('Failed to submit verification request');
    }
    
    setRequestingVerification(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold text-lg">Account Type</h2>
      </div>

      {/* Account Type Selection */}
      <div className="space-y-3">
        <button
          onClick={() => handleSwitchAccountType('personal')}
          className={`w-full p-4 rounded-xl border-2 transition-colors text-left flex items-center gap-4 ${
            formData.account_type === 'personal' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          disabled={loading}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Personal Account</p>
            <p className="text-sm text-muted-foreground">Standard personal profile</p>
          </div>
          {formData.account_type === 'personal' && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <BadgeCheck className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </button>

        <button
          onClick={() => handleSwitchAccountType('business')}
          className={`w-full p-4 rounded-xl border-2 transition-colors text-left flex items-center gap-4 ${
            formData.account_type === 'business' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          disabled={loading}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Business Account</p>
            <p className="text-sm text-muted-foreground">For creators, brands & businesses</p>
          </div>
          {formData.account_type === 'business' && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <BadgeCheck className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isBusinessAccount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Separator className="my-4" />

            {/* Business Info */}
            <div className="space-y-4">
              <h3 className="font-medium">Business Information</h3>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.business_category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, business_category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border z-[100]">
                    {businessCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_email">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Contact Email
                </Label>
                <Input
                  id="business_email"
                  type="email"
                  value={formData.business_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_email: e.target.value }))}
                  placeholder="business@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_website">
                  <Globe className="w-4 h-4 inline mr-2" />
                  Website
                </Label>
                <Input
                  id="business_website"
                  type="url"
                  value={formData.business_website}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_website: e.target.value }))}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <Button onClick={handleSaveBusinessInfo} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Business Info
              </Button>
            </div>

            <Separator className="my-4" />

            {/* Verification Section */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-accent" />
                Verification
              </h3>

              {isVerified ? (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="w-6 h-6 text-accent" />
                    <div>
                      <p className="font-medium text-accent">Verified Account</p>
                      <p className="text-sm text-muted-foreground">Your account is verified</p>
                    </div>
                  </div>
                </div>
              ) : verificationStatus === 'pending' ? (
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-warning animate-spin" />
                    <div>
                      <p className="font-medium">Verification Pending</p>
                      <p className="text-sm text-muted-foreground">We're reviewing your request</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {!showVerificationForm ? (
                    <button
                      onClick={() => setShowVerificationForm(true)}
                      className="w-full p-4 rounded-xl border border-border hover:border-primary/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <BadgeCheck className="w-5 h-5 text-muted-foreground" />
                        <span>Request Verification</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-4 rounded-xl border border-border"
                    >
                      <p className="text-sm text-muted-foreground">
                        Verified accounts show a badge next to their name. This helps users know the account is authentic.
                      </p>

                      <div className="space-y-2">
                        <Label>Why should we verify your account?</Label>
                        <Textarea
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          placeholder="Tell us about your brand, notable achievements, or why verification would help your audience..."
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowVerificationForm(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="gradient"
                          onClick={handleRequestVerification}
                          disabled={requestingVerification || !formData.business_category}
                          className="flex-1"
                        >
                          {requestingVerification ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Submit Request
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
