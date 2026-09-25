import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Video, X, MapPin, ArrowLeft, Upload, Save, FileText, Trash2, Camera, Film, Hash, Loader2, GripVertical, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhotoEditor } from '@/components/editor/PhotoEditor';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { pingIndexNow } from '@/lib/indexnow';
import { trackEvent } from '@/lib/analytics';

interface Draft {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
}

type MediaMode = 'photo' | 'video';

export default function CreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');
  const draftId = searchParams.get('draft');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-photo state
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Single file for video
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mediaMode, setMediaMode] = useState<MediaMode>('photo');
  const [audioName, setAudioName] = useState('');
  const [audioArtist, setAudioArtist] = useState('');
  const [alsoPostToStory, setAlsoPostToStory] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideo = file?.type.startsWith('video/') || existingMediaType === 'video';
  const hasMedia = photos.length > 0 || file || existingMediaUrl;

  useEffect(() => {
    if (user) {
      fetchDrafts();
      if (editPostId) {
        loadPostForEditing(editPostId);
      } else if (draftId) {
        trackEvent('draft_resume_opened', { draft_id: draftId });
        loadDraft(draftId);
      }
    }
  }, [user, editPostId, draftId]);

  useEffect(() => {
    if (!user || isEditing) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    if (caption.trim() || existingMediaUrl) {
      autoSaveTimeoutRef.current = setTimeout(() => saveDraft(true), 3000);
    }
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [caption, location, existingMediaUrl]);

  const fetchDrafts = async () => {
    if (!user) return;
    const { data } = await supabase.from('drafts').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    if (data) setDrafts(data);
  };

  const loadPostForEditing = async (postId: string) => {
    const { data: post } = await supabase.from('posts').select('*').eq('id', postId).eq('user_id', user?.id).single();
    if (post) {
      setCaption(post.caption || '');
      setLocation(post.location || '');
      setExistingMediaUrl(post.media_url);
      setExistingMediaType(post.media_type);
      setPreview(post.media_url);
      setIsEditing(true);
      setMediaMode(post.media_type === 'video' ? 'video' : 'photo');
    } else {
      toast.error('Post not found');
      navigate('/create');
    }
  };

  const loadDraft = async (id: string) => {
    // The draft list may not have loaded yet (deep link from the Draft Manager),
    // so fall back to fetching the single row directly.
    let draft = drafts.find(d => d.id === id) as Draft | undefined;
    if (!draft) {
      const { data } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id ?? '')
        .maybeSingle();
      draft = (data as Draft | null) ?? undefined;
    }
    if (draft) {
      setCaption(draft.caption || '');
      setLocation(draft.location || '');
      if (draft.media_url) {
        setExistingMediaUrl(draft.media_url);
        setExistingMediaType(draft.media_type);
        setPreview(draft.media_url);
        setMediaMode(draft.media_type === 'video' ? 'video' : 'photo');
      }
      setCurrentDraftId(draft.id);
      setActiveTab('create');
      trackEvent('draft_resume_loaded', { draft_id: draft.id, has_media: !!draft.media_url });
    } else {
      trackEvent('draft_resume_failed', { draft_id: id });
      toast.error('Draft not found');
    }
  };

  const saveDraft = async (isAutoSave = false) => {
    if (!user) return;
    try {
      let mediaUrl = existingMediaUrl;
      let mediaType = existingMediaType;
      const firstFile = photos.length > 0 ? photos[0].file : file;
      if (firstFile) {
        const fileExt = firstFile.name.split('.').pop();
        const fileName = `drafts/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(fileName, firstFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
        mediaUrl = publicUrl;
        mediaType = firstFile.type.startsWith('image/') ? 'image' : 'video';
      }
      const draftData = { user_id: user.id, caption: caption.trim() || null, media_url: mediaUrl, media_type: mediaType, location: location.trim() || null };
      if (currentDraftId) {
        await supabase.from('drafts').update(draftData).eq('id', currentDraftId);
      } else {
        const { data } = await supabase.from('drafts').insert(draftData).select().single();
        if (data) setCurrentDraftId(data.id);
      }
      if (!isAutoSave) toast.success('Draft saved');
      fetchDrafts();
    } catch {
      if (!isAutoSave) toast.error('Failed to save draft');
    }
  };

  const deleteDraft = async (id: string) => {
    await supabase.from('drafts').delete().eq('id', id);
    setDrafts(prev => prev.filter(d => d.id !== id));
    if (currentDraftId === id) clearForm();
    toast.success('Draft deleted');
  };

  const clearForm = () => {
    setFile(null);
    setPreview(null);
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setCaption('');
    setLocation('');
    setAudioName('');
    setAudioArtist('');
    setCurrentDraftId(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setIsEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!user) { navigate('/auth'); return null; }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    // Check if it's a video
    if (selectedFiles[0].type.startsWith('video/')) {
      if (selectedFiles[0].size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
        return;
      }
      setFile(selectedFiles[0]);
      setPreview(URL.createObjectURL(selectedFiles[0]));
      setExistingMediaUrl(null);
      setExistingMediaType(null);
      setMediaMode('video');
      setPhotos([]);
      return;
    }

    // Handle multiple photos
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    const totalPhotos = photos.length + imageFiles.length;
    
    if (totalPhotos > 5) {
      toast.error('Maximum 5 photos per post');
      return;
    }

    for (const f of imageFiles) {
      if (f.size > 100 * 1024 * 1024) {
        toast.error(`${f.name} is too large (max 100MB)`);
        return;
      }
    }

    const newPhotos: PhotoFile[] = imageFiles.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      preview: URL.createObjectURL(f),
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    setFile(null);
    setPreview(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setMediaMode('photo');
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (currentPhotoIndex >= updated.length && updated.length > 0) {
        setCurrentPhotoIndex(updated.length - 1);
      }
      return updated;
    });
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    setPhotos(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
    setCurrentPhotoIndex(to);
  };

  const applyEditedPhoto = (index: number, edited: File) => {
    setPhotos(prev => prev.map((p, i) => {
      if (i !== index) return p;
      URL.revokeObjectURL(p.preview);
      return { ...p, file: edited, preview: URL.createObjectURL(edited) };
    }));
    setEditingPhotoIndex(null);
  };



  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setPhotos([]);
    setCurrentPhotoIndex(0);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!hasMedia) {
      toast.error('Please select a file to upload');
      return;
    }
    setUploading(true);
    try {
      // Video → Reel
      if (isVideo && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);

        const { data: newReel } = await supabase.from('reels').insert({
          user_id: user.id, video_url: publicUrl,
          caption: caption.trim() || null,
          audio_name: audioName.trim() || null,
          audio_artist: audioArtist.trim() || null,
        }).select('id').single();
        if (currentDraftId) await supabase.from('drafts').delete().eq('id', currentDraftId);
        if (newReel?.id) pingIndexNow([`/reels`, `/reel/${newReel.id}`]);
        toast.success('Reel created!');
        navigate('/reels');
        return;
      }

      // Photos → Post(s) - upload first photo as post, rest as additional media
      if (photos.length > 0) {
        // Upload all photos
        const uploadedUrls: string[] = [];
        for (const photo of photos) {
          const fileExt = photo.file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('media').upload(fileName, photo.file);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }

        // Create post with first image (multi-photo stored as comma-separated in media_url)
        const mediaUrl = uploadedUrls.join(',');
        
        if (isEditing && editPostId) {
          await supabase.from('posts').update({
            media_url: mediaUrl, media_type: 'image',
            caption: caption.trim() || null, location: location.trim() || null,
          }).eq('id', editPostId).eq('user_id', user.id);
          pingIndexNow([`/post/${editPostId}`]);
          toast.success('Post updated!');
        } else {
          const { data: newPost } = await supabase.from('posts').insert({
            user_id: user.id, media_url: mediaUrl, media_type: 'image',
            caption: caption.trim() || null, location: location.trim() || null,
          }).select('id').single();
          if (alsoPostToStory && uploadedUrls[0]) {
            await supabase.from('stories').insert({
              user_id: user.id, media_url: uploadedUrls[0], media_type: 'image',
            });
          }
          if (currentDraftId) await supabase.from('drafts').delete().eq('id', currentDraftId);
          if (newPost?.id) pingIndexNow([`/`, `/explore`, `/post/${newPost.id}`]);
          toast.success(alsoPostToStory ? 'Post and story created!' : 'Post created!');
        }
        navigate('/');
        return;
      }

      // Existing media (editing)
      if (existingMediaUrl) {
        if (isEditing && editPostId) {
          await supabase.from('posts').update({
            media_url: existingMediaUrl, media_type: existingMediaType,
            caption: caption.trim() || null, location: location.trim() || null,
          }).eq('id', editPostId).eq('user_id', user.id);
          pingIndexNow([`/post/${editPostId}`]);
          toast.success('Post updated!');
        }
        navigate('/');
      }
    } catch (error: any) {
      console.error('Error creating content:', error);
      toast.error(error.message || 'Failed to create');
    } finally {
      setUploading(false);
    }
  };

  const showUploadArea = photos.length === 0 && !file && !preview && !existingMediaUrl;

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto pb-16">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">
              {isEditing ? 'Edit' : 'Create'} {isVideo ? 'Reel' : 'Post'}
            </h1>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button variant="ghost" size="icon" onClick={() => saveDraft()}
                  disabled={!caption.trim() && !hasMedia}>
                  <Save className="h-5 w-5" />
                </Button>
              )}
              <Button variant="gradient" size="sm" onClick={handleSubmit}
                disabled={!hasMedia || uploading}>
                {uploading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {uploading ? 'Posting...' : isEditing ? 'Update' : 'Share'}
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 m-4 max-w-[calc(100%-2rem)]">
            <TabsTrigger value="create"><Upload className="w-4 h-4 mr-2" />Create</TabsTrigger>
            <TabsTrigger value="drafts"><FileText className="w-4 h-4 mr-2" />Drafts ({drafts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="p-4 pt-0 space-y-4">
            {showUploadArea ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Media Type Selector */}
                <div className="flex gap-2 justify-center">
                  <Button variant={mediaMode === 'photo' ? 'gradient' : 'outline'} onClick={() => setMediaMode('photo')} className="flex-1">
                    <Image className="w-4 h-4 mr-2" />Photo
                  </Button>
                  <Button variant={mediaMode === 'video' ? 'gradient' : 'outline'} onClick={() => setMediaMode('video')} className="flex-1">
                    <Film className="w-4 h-4 mr-2" />Reel
                  </Button>
                </div>

                {/* Upload Area */}
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file"
                    accept={mediaMode === 'photo' ? 'image/*' : 'video/*'}
                    multiple={mediaMode === 'photo'}
                    onChange={handleFileSelect} className="hidden" />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    {mediaMode === 'photo' ? <Image className="w-8 h-8 text-primary" /> : <Film className="w-8 h-8 text-primary" />}
                  </div>
                  <h3 className="font-semibold mb-2">
                    Upload {mediaMode === 'photo' ? 'photos (up to 5)' : 'a video'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Tap to select from your device</p>
                </div>

                {/* Camera */}
                <div className="flex gap-4 justify-center">
                  <Button variant="outline" size="lg" onClick={() => {
                    if (cameraInputRef.current) {
                      cameraInputRef.current.accept = mediaMode === 'photo' ? 'image/*' : 'video/*';
                      cameraInputRef.current.capture = 'environment';
                      cameraInputRef.current.click();
                    }
                  }}>
                    <Camera className="w-5 h-5 mr-2" />Camera
                  </Button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleFileSelect} className="hidden" />
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Multi-photo carousel preview */}
                {photos.length > 0 && (
                  <div className="space-y-3">
                    {/* Main preview */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      <img src={photos[currentPhotoIndex]?.preview} alt="Preview" className="w-full h-full object-cover" />
                      
                      {/* Navigation arrows */}
                      {photos.length > 1 && (
                        <>
                          {currentPhotoIndex > 0 && (
                            <button onClick={() => setCurrentPhotoIndex(i => i - 1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                          )}
                          {currentPhotoIndex < photos.length - 1 && (
                            <button onClick={() => setCurrentPhotoIndex(i => i + 1)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          )}
                        </>
                      )}

                      {/* Photo counter */}
                      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                        {currentPhotoIndex + 1}/{photos.length}
                      </div>

                      {/* Remove current photo */}
                      <button onClick={() => removePhoto(currentPhotoIndex)}
                        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white">
                        <X className="w-4 h-4" />
                      </button>

                      {/* Edit current photo */}
                      <button onClick={() => setEditingPhotoIndex(currentPhotoIndex)}
                        className="absolute bottom-3 right-3 h-9 px-3 rounded-full bg-black/60 backdrop-blur flex items-center gap-1.5 text-white text-xs font-medium">
                        <Wand2 className="w-4 h-4" />Edit
                      </button>



                      {/* Dots indicator */}
                      {photos.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {photos.map((_, i) => (
                            <button key={i} onClick={() => setCurrentPhotoIndex(i)}
                              className={cn("w-2 h-2 rounded-full transition-all", i === currentPhotoIndex ? "bg-white w-4" : "bg-white/50")} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Thumbnail strip for reordering */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {photos.map((photo, index) => (
                        <div key={photo.id} className={cn(
                          "relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                          index === currentPhotoIndex ? "border-primary" : "border-transparent"
                        )} onClick={() => setCurrentPhotoIndex(index)}>
                          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                          <div className="absolute top-0.5 left-0.5 bg-black/60 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                            {index + 1}
                          </div>
                          {/* Reorder buttons */}
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-black/40">
                            {index > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); movePhoto(index, index - 1); }}
                                className="text-white p-0.5"><ChevronLeft className="w-3 h-3" /></button>
                            )}
                            <span className="flex-1" />
                            {index < photos.length - 1 && (
                              <button onClick={(e) => { e.stopPropagation(); movePhoto(index, index + 1); }}
                                className="text-white p-0.5"><ChevronRight className="w-3 h-3" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Add more photos button */}
                      {photos.length < 5 && (
                        <button onClick={() => fileInputRef.current?.click()}
                          className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                          <Upload className="w-5 h-5" />
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                    </div>
                  </div>
                )}

                {/* Single video/existing media preview */}
                {(file || (existingMediaUrl && photos.length === 0)) && (
                  <div className="relative">
                    <Button variant="secondary" size="icon" className="absolute top-2 right-2 z-10 rounded-full" onClick={clearFile}>
                      <X className="w-4 h-4" />
                    </Button>
                    <div className={cn("absolute top-2 left-2 z-10 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                      isVideo ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                      {isVideo ? <Film className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                      {isVideo ? 'Reel' : 'Post'}
                    </div>
                    {isVideo ? (
                      <video src={preview || existingMediaUrl || undefined} className="w-full aspect-[9/16] object-cover rounded-xl" controls />
                    ) : (
                      <img src={preview || existingMediaUrl || undefined} alt="Preview" className="w-full aspect-square object-cover rounded-xl" />
                    )}
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-2">
                  <Textarea placeholder="Write a caption..." value={caption}
                    onChange={(e) => setCaption(e.target.value)} className="min-h-[100px] resize-none" />
                  <p className="text-xs text-muted-foreground text-right">{caption.length}/2200</p>
                </div>

                {/* Location & Story option (photos only) */}
                {!isVideo && (
                  <>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input placeholder="Add location" value={location} onChange={(e) => setLocation(e.target.value)} className="pl-10" />
                    </div>
                    {!isEditing && (
                      <label className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl cursor-pointer">
                        <input type="checkbox" checked={alsoPostToStory} onChange={(e) => setAlsoPostToStory(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-primary accent-primary" />
                        <div className="flex-1">
                          <p className="font-medium">Also post to your story</p>
                          <p className="text-sm text-muted-foreground">Share this content as a story too</p>
                        </div>
                      </label>
                    )}
                  </>
                )}

                {/* Audio (video only) */}
                {isVideo && (
                  <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
                    <h4 className="font-medium flex items-center gap-2"><Hash className="w-4 h-4" />Audio (Optional)</h4>
                    <Input placeholder="Song name" value={audioName} onChange={(e) => setAudioName(e.target.value)} />
                    <Input placeholder="Artist" value={audioArtist} onChange={(e) => setAudioArtist(e.target.value)} />
                  </div>
                )}

                {currentDraftId && <p className="text-xs text-muted-foreground text-center">Auto-saving draft...</p>}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="p-4 pt-0">
            {drafts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No drafts yet</p>
                <p className="text-sm text-muted-foreground">Start creating and your work will be auto-saved</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => loadDraft(draft.id)}>
                    {draft.media_url ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                        {draft.media_type === 'video' ? (
                          <>
                            <video src={draft.media_url} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 bg-primary rounded px-1"><Film className="w-3 h-3 text-primary-foreground" /></div>
                          </>
                        ) : (
                          <img src={draft.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{draft.caption || 'No caption'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {editingPhotoIndex !== null && photos[editingPhotoIndex] && (
          <PhotoEditor
            open
            file={photos[editingPhotoIndex].file}
            onClose={() => setEditingPhotoIndex(null)}
            onSave={(edited) => applyEditedPhoto(editingPhotoIndex, edited)}
          />
        )}
      </div>
    </MainLayout>
  );
}
