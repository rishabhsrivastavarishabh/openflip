import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Image, Video, X, MapPin, ArrowLeft, Upload, Save, FileText, Trash2, Camera, Film, Hash, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface Draft {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
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
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isVideo = file?.type.startsWith('video/') || existingMediaType === 'video';

  useEffect(() => {
    if (user) {
      fetchDrafts();
      if (editPostId) {
        loadPostForEditing(editPostId);
      } else if (draftId) {
        loadDraft(draftId);
      }
    }
  }, [user, editPostId, draftId]);

  // Auto-save draft when content changes
  useEffect(() => {
    if (!user || isEditing) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (caption.trim() || existingMediaUrl) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveDraft(true);
      }, 3000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [caption, location, existingMediaUrl]);

  const fetchDrafts = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    
    if (data) {
      setDrafts(data);
    }
  };

  const loadPostForEditing = async (postId: string) => {
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', user?.id)
      .single();

    if (post) {
      setCaption(post.caption || '');
      setLocation(post.location || '');
      setExistingMediaUrl(post.media_url);
      setExistingMediaType(post.media_type);
      setPreview(post.media_url);
      setIsEditing(true);
      setMediaMode(post.media_type === 'video' ? 'video' : 'photo');
    } else {
      toast.error('Post not found or you cannot edit it');
      navigate('/create');
    }
  };

  const loadDraft = async (id: string) => {
    const draft = drafts.find(d => d.id === id);
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
    }
  };

  const saveDraft = async (isAutoSave = false) => {
    if (!user) return;

    try {
      let mediaUrl = existingMediaUrl;
      let mediaType = existingMediaType;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `drafts/${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      }

      const draftData = {
        user_id: user.id,
        caption: caption.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
        location: location.trim() || null,
      };

      if (currentDraftId) {
        await supabase
          .from('drafts')
          .update(draftData)
          .eq('id', currentDraftId);
      } else {
        const { data } = await supabase
          .from('drafts')
          .insert(draftData)
          .select()
          .single();
        
        if (data) {
          setCurrentDraftId(data.id);
        }
      }

      if (!isAutoSave) {
        toast.success('Draft saved');
      }
      fetchDrafts();
    } catch (error: any) {
      if (!isAutoSave) {
        toast.error('Failed to save draft');
      }
    }
  };

  const deleteDraft = async (id: string) => {
    await supabase
      .from('drafts')
      .delete()
      .eq('id', id);
    
    setDrafts(prev => prev.filter(d => d.id !== id));
    
    if (currentDraftId === id) {
      clearForm();
    }
    
    toast.success('Draft deleted');
  };

  const clearForm = () => {
    setFile(null);
    setPreview(null);
    setCaption('');
    setLocation('');
    setAudioName('');
    setAudioArtist('');
    setCurrentDraftId(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setIsEditing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isImageFile = selectedFile.type.startsWith('image/');
    const isVideoFile = selectedFile.type.startsWith('video/');

    if (!isImageFile && !isVideoFile) {
      toast.error('Please select an image or video file');
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error('File size must be less than 100MB');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setMediaMode(isVideoFile ? 'video' : 'photo');
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!file && !existingMediaUrl) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      let mediaUrl = existingMediaUrl;
      let mediaType = existingMediaType;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      }

      // If it's a video, create a Reel instead of a Post
      if (mediaType === 'video') {
        const { error: reelError } = await supabase
          .from('reels')
          .insert({
            user_id: user.id,
            video_url: mediaUrl,
            caption: caption.trim() || null,
            audio_name: audioName.trim() || null,
            audio_artist: audioArtist.trim() || null,
          });

        if (reelError) throw reelError;

        // Delete draft if posting from one
        if (currentDraftId) {
          await supabase.from('drafts').delete().eq('id', currentDraftId);
        }

        toast.success('Reel created!');
        navigate('/reels');
      } else {
        // Create post for images
        if (isEditing && editPostId) {
          const { error: updateError } = await supabase
            .from('posts')
            .update({
              media_url: mediaUrl,
              media_type: mediaType,
              caption: caption.trim() || null,
              location: location.trim() || null,
            })
            .eq('id', editPostId)
            .eq('user_id', user.id);

          if (updateError) throw updateError;
          toast.success('Post updated!');
        } else {
          const { error: postError } = await supabase
            .from('posts')
            .insert({
              user_id: user.id,
              media_url: mediaUrl,
              media_type: mediaType,
              caption: caption.trim() || null,
              location: location.trim() || null,
            });

              if (postError) throw postError;

              // Also post to story if option selected
              if (alsoPostToStory && mediaUrl) {
                await supabase.from('stories').insert({
                  user_id: user.id,
                  media_url: mediaUrl,
                  media_type: mediaType || 'image',
                });
              }

              if (currentDraftId) {
                await supabase.from('drafts').delete().eq('id', currentDraftId);
              }

              toast.success(alsoPostToStory ? 'Post and story created!' : 'Post created!');
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

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => saveDraft()}
                  disabled={!caption.trim() && !file && !existingMediaUrl}
                >
                  <Save className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="gradient"
                size="sm"
                onClick={handleSubmit}
                disabled={(!file && !existingMediaUrl) || uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                {uploading ? 'Posting...' : isEditing ? 'Update' : 'Share'}
              </Button>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 m-4 max-w-[calc(100%-2rem)]">
            <TabsTrigger value="create">
              <Upload className="w-4 h-4 mr-2" />
              Create
            </TabsTrigger>
            <TabsTrigger value="drafts">
              <FileText className="w-4 h-4 mr-2" />
              Drafts ({drafts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="p-4 pt-0 space-y-4">
            {/* File Upload */}
            {!preview ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Media Type Selector */}
                <div className="flex gap-2 justify-center">
                  <Button
                    variant={mediaMode === 'photo' ? 'gradient' : 'outline'}
                    onClick={() => setMediaMode('photo')}
                    className="flex-1"
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Photo
                  </Button>
                  <Button
                    variant={mediaMode === 'video' ? 'gradient' : 'outline'}
                    onClick={() => setMediaMode('video')}
                    className="flex-1"
                  >
                    <Film className="w-4 h-4 mr-2" />
                    Reel
                  </Button>
                </div>

                {/* Upload Area */}
                <div
                  className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={mediaMode === 'photo' ? 'image/*' : 'video/*'}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    {mediaMode === 'photo' ? (
                      <Image className="w-8 h-8 text-primary" />
                    ) : (
                      <Film className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <h3 className="font-semibold mb-2">
                    Upload a {mediaMode === 'photo' ? 'photo' : 'video'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tap to select from your device
                  </p>
                </div>

                {/* Camera Option */}
                <div className="flex gap-4 justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      if (cameraInputRef.current) {
                        cameraInputRef.current.accept = mediaMode === 'photo' ? 'image/*' : 'video/*';
                        cameraInputRef.current.capture = 'environment';
                        cameraInputRef.current.click();
                      }
                    }}
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Camera
                  </Button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
              >
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 z-10 rounded-full"
                  onClick={clearFile}
                >
                  <X className="w-4 h-4" />
                </Button>
                
                {/* Media Type Badge */}
                <div className={cn(
                  "absolute top-2 left-2 z-10 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                  isVideo 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground"
                )}>
                  {isVideo ? <Film className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                  {isVideo ? 'Reel' : 'Post'}
                </div>

                {isVideo ? (
                  <video
                    src={preview}
                    className="w-full aspect-[9/16] object-cover rounded-xl"
                    controls
                  />
                ) : (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                )}
              </motion.div>
            )}

            {/* Caption */}
            <div className="space-y-2">
              <Textarea
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {caption.length}/2200
              </p>
            </div>

            {/* Location (only for photos) */}
            {!isVideo && (
              <>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Add location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Also post to story option */}
                {!isEditing && (
                  <label className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoPostToStory}
                      onChange={(e) => setAlsoPostToStory(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-primary accent-primary"
                    />
                    <div className="flex-1">
                      <p className="font-medium">Also post to your story</p>
                      <p className="text-sm text-muted-foreground">Share this content as a story too</p>
                    </div>
                  </label>
                )}
              </>
            )}

            {/* Audio info (only for videos/reels) */}
            {isVideo && (
              <div className="space-y-3 p-4 bg-secondary/50 rounded-xl">
                <h4 className="font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Audio (Optional)
                </h4>
                <Input
                  placeholder="Song name"
                  value={audioName}
                  onChange={(e) => setAudioName(e.target.value)}
                />
                <Input
                  placeholder="Artist"
                  value={audioArtist}
                  onChange={(e) => setAudioArtist(e.target.value)}
                />
              </div>
            )}

            {currentDraftId && (
              <p className="text-xs text-muted-foreground text-center">
                Auto-saving draft...
              </p>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="p-4 pt-0">
            {drafts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No drafts yet</p>
                <p className="text-sm text-muted-foreground">
                  Start creating and your work will be auto-saved
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    onClick={() => loadDraft(draft.id)}
                  >
                    {draft.media_url ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                        {draft.media_type === 'video' ? (
                          <>
                            <video src={draft.media_url} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 bg-primary rounded px-1">
                              <Film className="w-3 h-3 text-primary-foreground" />
                            </div>
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
                      <p className="text-sm line-clamp-2">
                        {draft.caption || 'No caption'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraft(draft.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
