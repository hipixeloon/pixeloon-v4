import { useState } from "react";
import { X, Play, Video, ChevronDown, ChevronUp, Download, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface VideoPreviewGridProps {
  videoLinks: string[];
  onRemove?: (index: number) => void;
  maxVisible?: number;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

export const VideoPreviewGrid = ({ 
  videoLinks, 
  onRemove,
  maxVisible = 12 
}: VideoPreviewGridProps) => {
  const [showAll, setShowAll] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestStatus>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  if (videoLinks.length === 0) return null;

  const visibleLinks = showAll ? videoLinks : videoLinks.slice(0, maxVisible);
  const hiddenCount = videoLinks.length - maxVisible;

  const handleOpenVideo = (url: string) => {
    window.open(url, "_blank");
  };

  const handleTestDownload = async (url: string, index: number) => {
    setTestingIndex(index);
    setTestResults(prev => ({ ...prev, [index]: 'testing' }));

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/test-drive-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResults(prev => ({ ...prev, [index]: 'success' }));
        toast.success(`Video #${index + 1}: ${data.message}`);
      } else {
        setTestResults(prev => ({ ...prev, [index]: 'failed' }));
        toast.error(`Video #${index + 1}: ${data.error}`);
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [index]: 'failed' }));
      toast.error(`Video #${index + 1}: Test failed`);
    } finally {
      setTestingIndex(null);
    }
  };

  const getStatusIcon = (index: number) => {
    const status = testResults[index];
    if (status === 'success') return <CheckCircle className="h-3 w-3 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-3 w-3 text-destructive" />;
    return null;
  };

  const handleTestAll = async () => {
    setIsTestingAll(true);
    setTestResults({});
    
    const results: Record<number, TestStatus> = {};
    
    // Test all links in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < videoLinks.length; i += batchSize) {
      const batch = videoLinks.slice(i, i + batchSize);
      const batchPromises = batch.map(async (url, batchIndex) => {
        const index = i + batchIndex;
        results[index] = 'testing';
        setTestResults({ ...results });
        
        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/test-drive-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          const data = await response.json();
          results[index] = data.success ? 'success' : 'failed';
        } catch {
          results[index] = 'failed';
        }
      });
      await Promise.all(batchPromises);
      setTestResults({ ...results });
    }
    
    const successCount = Object.values(results).filter(s => s === 'success').length;
    const failedCount = Object.values(results).filter(s => s === 'failed').length;
    
    if (failedCount === 0) {
      toast.success(`All ${successCount} videos passed download test!`);
    } else {
      toast.error(`${failedCount} of ${videoLinks.length} videos failed. ${successCount} passed.`);
    }
    
    setIsTestingAll(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Video Queue ({videoLinks.length})
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAll}
            disabled={isTestingAll || videoLinks.length === 0}
            className="text-xs"
          >
            {isTestingAll ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1" />
                Test All
              </>
            )}
          </Button>
          {videoLinks.length > maxVisible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show All ({hiddenCount} more)
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {visibleLinks.map((link, index) => {
          const isTesting = testingIndex === index;
          const status = testResults[index];
          
          return (
            <div
              key={index}
              className={`relative group aspect-[9/16] rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                status === 'success' 
                  ? 'bg-green-500/10 border-green-500/50' 
                  : status === 'failed'
                  ? 'bg-destructive/10 border-destructive/50'
                  : 'bg-gradient-to-br from-primary/20 to-primary/5 border-border hover:border-primary/50'
              }`}
              onClick={() => handleOpenVideo(link)}
            >
              <div className="w-full h-full flex flex-col items-center justify-center">
                {isTesting ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <>
                    <Video className="h-5 w-5 text-primary/60 mb-1" />
                    <span className="text-xs font-semibold text-foreground">#{index + 1}</span>
                  </>
                )}
              </div>

              {/* Status indicator */}
              {!isTesting && getStatusIcon(index) && (
                <div className="absolute top-0.5 left-0.5">
                  {getStatusIcon(index)}
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestDownload(link, index);
                  }}
                  disabled={isTesting}
                  className="bg-background/90 text-foreground rounded-full p-1.5 hover:bg-background transition-colors"
                  title="Test download"
                >
                  <Download className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenVideo(link);
                  }}
                  className="bg-background/90 text-foreground rounded-full p-1.5 hover:bg-background transition-colors"
                  title="Open video"
                >
                  <Play className="h-3 w-3" />
                </button>
              </div>

              {/* Remove button */}
              {onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!showAll && hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          +{hiddenCount} more videos
        </p>
      )}
    </div>
  );
};