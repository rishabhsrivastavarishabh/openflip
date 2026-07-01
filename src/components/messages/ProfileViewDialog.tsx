import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { UserPlus, UserMinus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Profile } from '@/types/database';
import { useFollowRelationship } from '@/hooks/useFollowRelationship';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: (Profile & { is_verified?: boolean }) | null;
  isOnline?: boolean;
}

export function ProfileViewDialog({ open, onOpenChange, profile, isOnline }: ProfileViewDialogProps) {
  const { user } = useAuth();
  const { isFollowing, refresh, loading } = useFollowRelationship(profile?.id || '');
  const [isToggling, setIsToggling] = useState(false);

  if (!profile) return null;

  const isOwnProfile = user?.id === profile.id;

  const handleToggleFollow = async () => {
    if (!user || !profile) return;
    setIsToggling(true);

    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);
        toast.success(`Unfollowed ${profile.username}`);
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: profile.id });
        toast.success(`Following ${profile.username}`);
      }
      await refresh();
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header with close button */}
        <div className="relative">
          {/* Cover/Background */}
          <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/10" />
          
          {/* Avatar */}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-background">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full" />
              )}
            </div>
          </div>
          
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="pt-14 pb-6 px-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <h2 className="text-xl font-semibold">{profile.username}</h2>
            {profile.is_verified && <VerifiedBadge size="md" />}
          </div>
          
          {profile.full_name && (
            <p className="text-muted-foreground text-sm mb-2">{profile.full_name}</p>
          )}
          
          {profile.bio && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{profile.bio}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-center">
            <Link to={`/profile/${profile.username}`} onClick={() => onOpenChange(false)}>
              <Button variant="outline" className="flex-1">
                View Profile
              </Button>
            </Link>
            
            {!isOwnProfile && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleToggleFollow}
                disabled={isToggling || loading}
                className="flex-1"
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="w-4 h-4 mr-1" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
