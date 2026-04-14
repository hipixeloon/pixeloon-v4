import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, FolderOpen, Info } from "lucide-react";
import { toast } from "sonner";

interface BulkLinkExtractorProps {
  onLinksExtracted: (links: string[]) => void;
  existingLinks?: string[];
}

export const BulkLinkExtractor = ({ onLinksExtracted, existingLinks = [] }: BulkLinkExtractorProps) => {
  const [folderLink, setFolderLink] = useState("");
  const [extractedLinks, setExtractedLinks] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const isValidFolderLink = folderLink.includes("drive.google.com/drive/folders/");

  const folderHref = folderLink.trim();

  // Extract file ID from Drive link for deduplication
  const getFileId = (url: string): string | null => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  // Get existing file IDs for duplicate checking
  const existingFileIds = new Set(
    existingLinks.map(getFileId).filter(Boolean)
  );

  const handleCopyScript = () => {
    const script = `// Run this in browser console (F12) while on the Google Drive folder page
// This will copy all video file links to your clipboard

const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
const links = [];

document.querySelectorAll('[data-id]').forEach(el => {
  const id = el.getAttribute('data-id');
  const name = el.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
  if (id && videoExtensions.some(ext => name.toLowerCase().includes(ext))) {
    links.push('https://drive.google.com/file/d/' + id + '/view');
  }
});

if (links.length === 0) {
  // Alternative method - get all file IDs
  document.querySelectorAll('[data-id]').forEach(el => {
    const id = el.getAttribute('data-id');
    if (id) links.push('https://drive.google.com/file/d/' + id + '/view');
  });
}

copy(links.join('\\n'));
console.log('Copied ' + links.length + ' links to clipboard!');
alert('Copied ' + links.length + ' video links to clipboard!');`;

    navigator.clipboard.writeText(script);
    toast.success("Script copied! Open the folder and paste in browser console (F12)");
  };

  const handleExtractFromPaste = () => {
    const lines = extractedLinks
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.includes("drive.google.com/file/d/"));
    
    if (lines.length === 0) {
      toast.error("No valid Google Drive file links found");
      return;
    }

    // Deduplicate: remove links already in existingLinks and internal duplicates
    const seenIds = new Set<string>();
    const uniqueLinks: string[] = [];
    let duplicateCount = 0;

    for (const link of lines) {
      const fileId = getFileId(link);
      if (!fileId) continue;
      
      if (existingFileIds.has(fileId) || seenIds.has(fileId)) {
        duplicateCount++;
      } else {
        seenIds.add(fileId);
        uniqueLinks.push(link);
      }
    }

    if (uniqueLinks.length > 0) {
      onLinksExtracted(uniqueLinks);
      if (duplicateCount > 0) {
        toast.warning(`Added ${uniqueLinks.length} links, skipped ${duplicateCount} duplicates`);
      } else {
        toast.success(`Extracted ${uniqueLinks.length} video links!`);
      }
      setExtractedLinks("");
      setFolderLink("");
      setShowInstructions(false);
    } else {
      toast.error(`All ${duplicateCount} links are duplicates`);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Bulk Link Extractor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Google Drive Folder Link</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderLink}
              onChange={(e) => setFolderLink(e.target.value)}
              className="flex-1"
            />
            {isValidFolderLink && (
              <Button asChild variant="outline" size="icon">
                <a href={folderHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {isValidFolderLink && (
          <>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowInstructions(!showInstructions)}
            >
              <Info className="h-4 w-4 mr-2" />
              {showInstructions ? "Hide" : "Show"} Extraction Instructions
            </Button>

            {showInstructions && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg text-sm">
                <h4 className="font-semibold">How to extract all video links:</h4>
                
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <div>
                      <p className="font-medium">Open the folder</p>
                      <p className="text-muted-foreground">Click the button above to open your Google Drive folder</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <div>
                      <p className="font-medium">Copy this script</p>
                      <Button size="sm" variant="secondary" onClick={handleCopyScript} className="mt-1">
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Script
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <div>
                      <p className="font-medium">Open browser console</p>
                      <p className="text-muted-foreground">Press F12 → Console tab</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <div>
                      <p className="font-medium">Paste & run the script</p>
                      <p className="text-muted-foreground">If Chrome warns you, type <span className="font-mono">allow pasting</span> and press Enter, then paste the script and run it.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">5</span>
                    <div>
                      <p className="font-medium">Paste links below</p>
                      <p className="text-muted-foreground">Come back here and paste the extracted links</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Paste extracted links here:</label>
                  <Textarea
                    placeholder="Paste your extracted video links here (one per line)..."
                    value={extractedLinks}
                    onChange={(e) => setExtractedLinks(e.target.value)}
                    rows={5}
                  />
                  <Button 
                    onClick={handleExtractFromPaste}
                    disabled={!extractedLinks.trim()}
                    className="w-full"
                  >
                    Add {extractedLinks.split("\n").filter(l => l.includes("drive.google.com/file/d/")).length} Links to Campaign
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
