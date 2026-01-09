import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2, Pin, PinOff, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PostActionsProps {
  postId: string;
  isPinned?: boolean;
  onDeleted?: () => void;
  onPinChanged?: () => void;
}

export function PostActions({ postId, isPinned = false, onDeleted, onPinChanged }: PostActionsProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);

  const handleEdit = () => {
    navigate(`/create?edit=${postId}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      // Delete related data first
      await supabase.from('likes').delete().eq('post_id', postId);
      await supabase.from('comments').delete().eq('post_id', postId);
      await supabase.from('saves').delete().eq('post_id', postId);
      await supabase.from('post_hashtags').delete().eq('post_id', postId);
      await supabase.from('notifications').delete().eq('post_id', postId);
      
      // Delete the post
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      
      if (error) throw error;
      
      toast.success('Post deleted');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async () => {
    setPinning(true);
    
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_pinned: !isPinned })
        .eq('id', postId);
      
      if (error) {
        if (error.message.includes('Cannot pin more than 3 posts')) {
          toast.error('You can only pin up to 3 posts');
        } else {
          throw error;
        }
      } else {
        toast.success(isPinned ? 'Post unpinned' : 'Post pinned to profile');
        onPinChanged?.();
      }
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update pin status');
    } finally {
      setPinning(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Post
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePin} disabled={pinning}>
            {isPinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                Unpin from Profile
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                Pin to Profile
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post 
              and all associated likes, comments, and saves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
