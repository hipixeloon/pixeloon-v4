import { ChevronRight, Clock, Video, Facebook } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CampaignCardProps {
  id: string;
  name: string;
  videosCount: number;
  scheduledPosts: number;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  pageNames?: string[];
}

export function CampaignCard({
  id,
  name,
  videosCount,
  scheduledPosts,
  status,
  createdAt,
  pageNames = [],
}: CampaignCardProps) {
  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-ios-green/20 text-ios-green',
    completed: 'bg-primary/20 text-primary',
  };

  return (
    <Link
      to={`/campaign/${id}`}
      className="ios-card p-4 flex items-center justify-between active:bg-secondary/50 transition-colors min-h-[88px]"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-ios-headline text-foreground truncate">{name}</h3>
          <span className={`text-ios-caption px-2.5 py-1 rounded-full ${statusColors[status]}`}>
            {status}
          </span>
        </div>
        
        {/* Page names */}
        {pageNames.length > 0 && (
          <div className="flex items-center gap-1.5 text-ios-footnote text-primary">
            <Facebook className="w-3.5 h-3.5" />
            <span className="truncate">{pageNames.join(', ')}</span>
          </div>
        )}
        
        <div className="flex items-center gap-4 text-ios-footnote text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Video className="w-4 h-4" />
            {videosCount} videos
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {scheduledPosts} scheduled
          </span>
        </div>
        
        <p className="text-ios-caption text-muted-foreground">
          Created {createdAt}
        </p>
      </div>
      
      <ChevronRight className="w-6 h-6 text-muted-foreground flex-shrink-0 ml-3" />
    </Link>
  );
}
