import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type ThumbnailMode = 'none' | 'auto' | 'fixed';

const safeHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

interface Props {
  mode: ThumbnailMode;
  setMode: (m: ThumbnailMode) => void;
  url: string;
  setUrl: (u: string) => void;
  titleOverlay: boolean;
  setTitleOverlay: (v: boolean) => void;
}

const MAX_THUMB_BYTES = 2 * 1024 * 1024; // YouTube's 2MB thumbnail limit

/**
 * Shared editor for a campaign's YouTube thumbnail strategy.
 * - none  : YouTube auto-picks a frame
 * - auto  : generate a thumbnail from each video's own frame (optional title band)
 * - fixed : one image for every video (paste a link or upload a file)
 */
export function YouTubeThumbnailSettings({ mode, setMode, url, setUrl, titleOverlay, setTitleOverlay }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const previewUrl = safeHttpUrl(url);

  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast({ title: 'Please log in first', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Choose an image file (JPG or PNG)', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_THUMB_BYTES) {
      toast({ title: 'Image too large', description: 'YouTube thumbnails must be under 2MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('thumbnails').getPublicUrl(path);
      setUrl(data.publicUrl);
      toast({ title: 'Thumbnail uploaded' });
    } catch (err) {
      console.error('Thumbnail upload error:', err);
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">YouTube Thumbnail</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as ThumbnailMode)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            <SelectItem value="none">Default (YouTube picks a frame)</SelectItem>
            <SelectItem value="auto">Auto-generate from each video</SelectItem>
            <SelectItem value="fixed">Use one image for all videos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'auto' && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="pr-3">
            <Label className="text-sm font-medium">Add title text on thumbnail</Label>
            <p className="text-xs text-muted-foreground">Overlays the video title in a clean band (needs Cloudinary configured).</p>
          </div>
          <Switch checked={titleOverlay} onCheckedChange={setTitleOverlay} />
        </div>
      )}

      {mode === 'fixed' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Image link</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/thumbnail.jpg"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div>
            <input
              id="yt-thumb-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileUpload(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById('yt-thumb-file')?.click()}
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload image
            </Button>
          </div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Thumbnail preview"
              className="w-full max-w-xs rounded-md border object-cover aspect-video"
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ImageIcon className="w-4 h-4" /> No image set yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
