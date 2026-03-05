import { useState, useRef } from 'react';
import { ArrowLeft, Upload, FileText, Shield, Check, Loader2, Eye, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Props {
  onBack: () => void;
}

export function BusinessVerificationFlow({ onBack }: Props) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [govIdFile, setGovIdFile] = useState<File | null>(null);
  const [govIdPreview, setGovIdPreview] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const govIdRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  useState(() => {
    if (user) {
      supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setExistingRequest(data);
        });
    }
  });

  const handleFileSelect = (file: File, type: 'govId' | 'doc') => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === 'govId') {
      setGovIdFile(file);
      setGovIdPreview(url);
    } else {
      setDocFile(file);
      setDocPreview(url);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || !govIdFile || !category) return;
    setLoading(true);
    try {
      const govIdUrl = await uploadFile(govIdFile, `verification/${user.id}/gov-id-${Date.now()}`);
      let docUrl = null;
      if (docFile) {
        docUrl = await uploadFile(docFile, `verification/${user.id}/doc-${Date.now()}`);
      }

      const { error } = await supabase.from('verification_requests').insert({
        user_id: user.id,
        category,
        business_name: businessName || null,
        business_email: businessEmail || null,
        document_type: documentType || null,
        government_id_url: govIdUrl,
        document_url: docUrl,
      });

      if (error) throw error;

      await supabase.from('profiles').update({ verification_status: 'pending', verification_requested_at: new Date().toISOString() }).eq('id', user.id);

      toast.success('Verification request submitted!');
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (existingRequest && step === 1) {
    const statusColor = existingRequest.status === 'approved' ? 'text-green-500' : existingRequest.status === 'rejected' ? 'text-destructive' : 'text-yellow-500';
    return (
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="font-semibold text-lg">Verification Status</h1>
          </div>
        </header>
        <div className="p-4 space-y-6">
          <div className="p-6 rounded-2xl bg-secondary/50 text-center space-y-4">
            <Shield className={`w-16 h-16 mx-auto ${statusColor}`} />
            <div>
              <p className="font-semibold text-lg capitalize">{existingRequest.status}</p>
              {existingRequest.request_id && <p className="text-sm text-muted-foreground font-mono">{existingRequest.request_id}</p>}
            </div>
            <p className="text-sm text-muted-foreground">
              {existingRequest.status === 'pending' && 'Your verification is under review. This usually takes 1-3 business days.'}
              {existingRequest.status === 'approved' && 'Your account has been verified! The badge is now visible on your profile.'}
              {existingRequest.status === 'rejected' && 'Your verification was not approved. You can submit a new request.'}
            </p>
            {existingRequest.notes && (
              <div className="p-3 rounded-lg bg-muted text-sm text-left">
                <p className="font-medium mb-1">Review Notes:</p>
                <p className="text-muted-foreground">{existingRequest.notes}</p>
              </div>
            )}
          </div>
          {existingRequest.status === 'rejected' && (
            <Button variant="gradient" className="w-full" onClick={() => { setExistingRequest(null); setStep(1); }}>
              Submit New Request
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="font-semibold text-lg">Request Submitted</h1>
          </div>
        </header>
        <div className="p-4 text-center space-y-6 py-12">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Verification Submitted!</h2>
            <p className="text-muted-foreground">We'll review your documents within 1-3 business days. You'll be notified once reviewed.</p>
          </div>
          <Button variant="gradient" onClick={onBack}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={step > 1 ? () => setStep(step - 1) : onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Business Verification</h1>
          <span className="ml-auto text-sm text-muted-foreground">Step {step}/3</span>
        </div>
      </header>

      {/* Progress */}
      <div className="flex gap-1 px-4 pt-3">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <div className="p-4 space-y-6">
        {step === 1 && (
          <>
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Account Details</h2>
              <p className="text-sm text-muted-foreground">Tell us about your account type and business.</p>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="public_figure">Public Figure</SelectItem>
                    <SelectItem value="media">Media / News</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Business / Brand Name</Label>
                <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your business name" />
              </div>
              <div className="space-y-2">
                <Label>Business Email</Label>
                <Input type="email" value={businessEmail} onChange={e => setBusinessEmail(e.target.value)} placeholder="business@example.com" />
              </div>
            </div>
            <Button variant="gradient" className="w-full" onClick={() => setStep(2)} disabled={!category}>
              Continue
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Government ID *</h2>
              <p className="text-sm text-muted-foreground">Upload a valid government-issued photo ID (Aadhaar, PAN, Passport, Driving Licence).</p>
              
              <input ref={govIdRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'govId')} />
              
              {govIdPreview ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={govIdPreview} alt="ID Preview" className="w-full h-48 object-contain bg-muted" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setPreviewImage(govIdPreview)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => { setGovIdFile(null); setGovIdPreview(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-2 bg-green-500/10 text-green-600 text-xs font-medium text-center">
                    <Check className="w-3 h-3 inline mr-1" />Document uploaded
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => govIdRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 hover:bg-secondary/50 transition-colors"
                >
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Tap to upload</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG or PDF • Max 10MB</p>
                  </div>
                </button>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Business Document (Optional)</h2>
              <p className="text-sm text-muted-foreground">GST certificate, trade licence, or incorporation certificate.</p>
              
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gst">GST Certificate</SelectItem>
                    <SelectItem value="trade_licence">Trade Licence</SelectItem>
                    <SelectItem value="incorporation">Incorporation Certificate</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <input ref={docRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'doc')} />

              {docPreview ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={docPreview} alt="Doc Preview" className="w-full h-32 object-contain bg-muted" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setPreviewImage(docPreview)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => { setDocFile(null); setDocPreview(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => docRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Tap to upload document</p>
                </button>
              )}
            </div>

            <Button variant="gradient" className="w-full" onClick={() => setStep(3)} disabled={!govIdFile}>
              Continue
            </Button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Review & Submit</h2>
              <p className="text-sm text-muted-foreground">Please review your information before submitting.</p>
              
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Category:</span> <span className="font-medium capitalize">{category}</span></p>
                  {businessName && <p className="text-sm"><span className="text-muted-foreground">Business:</span> <span className="font-medium">{businessName}</span></p>}
                  {businessEmail && <p className="text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{businessEmail}</span></p>}
                </div>
                
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-sm font-medium mb-2">Documents</p>
                  <div className="flex gap-3">
                    {govIdPreview && (
                      <button onClick={() => setPreviewImage(govIdPreview)} className="w-16 h-16 rounded-lg overflow-hidden border">
                        <img src={govIdPreview} alt="ID" className="w-full h-full object-cover" />
                      </button>
                    )}
                    {docPreview && (
                      <button onClick={() => setPreviewImage(docPreview)} className="w-16 h-16 rounded-lg overflow-hidden border">
                        <img src={docPreview} alt="Doc" className="w-full h-full object-cover" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Your documents are securely stored and only accessible to our review team.
                  </p>
                </div>
              </div>
            </div>

            <Button variant="gradient" className="w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</> : 'Submit for Review'}
            </Button>
          </>
        )}
      </div>

      {/* Full-screen preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-0 bg-black border-none">
          {previewImage && <img src={previewImage} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
