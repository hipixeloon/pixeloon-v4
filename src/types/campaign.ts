export interface VideoLink {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
}

export interface ScheduledPost {
  id: string;
  videoId: string;
  scheduledTime: string;
  caption: string;
  hashtags: string[];
  status: 'pending' | 'posted' | 'failed';
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  videos: VideoLink[];
  scheduledPosts: ScheduledPost[];
  template?: {
    type: 'ai' | 'manual' | 'hybrid';
    content: string;
  };
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface AIGeneratedContent {
  description: string;
  hashtags: string[];
  suggestedCaptions: string[];
}
