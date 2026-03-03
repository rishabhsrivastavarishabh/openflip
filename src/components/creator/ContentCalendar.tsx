import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, getDay, startOfWeek, endOfWeek
} from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ContentCalendarProps {
  onBack: () => void;
}

interface DayPost {
  id: string;
  media_type: string;
  media_url: string;
  caption: string | null;
  created_at: string;
}

export function ContentCalendar({ onBack }: ContentCalendarProps) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [postsByDate, setPostsByDate] = useState<Record<string, DayPost[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMonthPosts();
  }, [user, currentMonth]);

  const fetchMonthPosts = async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(currentMonth).toISOString();
    const monthEnd = endOfMonth(currentMonth).toISOString();

    const { data } = await supabase
      .from('posts')
      .select('id, media_type, media_url, caption, created_at')
      .eq('user_id', user.id)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .order('created_at', { ascending: true });

    const grouped: Record<string, DayPost[]> = {};
    data?.forEach(post => {
      const key = format(new Date(post.created_at), 'yyyy-MM-dd');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(post);
    });

    setPostsByDate(grouped);
    setLoading(false);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedPosts = selectedKey ? postsByDate[selectedKey] || [] : [];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Content Calendar</h1>
      </header>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Loading calendar..." />
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground font-medium">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayPosts = postsByDate[key] || [];
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[56px] md:min-h-[72px] p-1 text-left bg-background transition-colors relative",
                    !isCurrentMonth && "opacity-40",
                    isSelected && "ring-2 ring-primary ring-inset",
                    isToday && "bg-accent/30"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    isToday && "text-primary font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap">
                      {dayPosts.slice(0, 3).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{dayPosts.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Detail */}
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-secondary/50 border space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{format(selectedDate, 'EEEE, MMMM d')}</h3>
                <Button asChild size="sm" variant="gradient">
                  <Link to={`/create?date=${format(selectedDate, 'yyyy-MM-dd')}`}>
                    <Plus className="h-4 w-4 mr-1" />
                    Plan Post
                  </Link>
                </Button>
              </div>

              {selectedPosts.length > 0 ? (
                <div className="space-y-2">
                  {selectedPosts.map(post => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {post.media_type === 'video' ? (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10">
                            <Circle className="w-4 h-4 text-primary" />
                          </div>
                        ) : (
                          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {post.caption || 'No caption'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), 'h:mm a')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {post.media_type}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No posts on this day
                </p>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
