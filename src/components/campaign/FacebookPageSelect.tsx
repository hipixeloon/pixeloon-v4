import { Facebook, Plus, Check, RefreshCw } from 'lucide-react';
import { FacebookPage } from '@/hooks/usePlatformConnections';

interface FacebookPageSelectProps {
  pages: FacebookPage[];
  selectedPageIds: string[];
  onSelect: (pageIds: string[]) => void;
  onConnectNew: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  refreshing?: boolean;
}

export function FacebookPageSelect({
  pages,
  selectedPageIds,
  onSelect,
  onConnectNew,
  onRefresh,
  loading,
  refreshing,
}: FacebookPageSelectProps) {
  const togglePage = (pageId: string) => {
    if (selectedPageIds.includes(pageId)) {
      onSelect(selectedPageIds.filter((id) => id !== pageId));
    } else {
      onSelect([...selectedPageIds, pageId]);
    }
  };

  const selectAll = () => {
    if (selectedPageIds.length === pages.length) {
      onSelect([]);
    } else {
      onSelect(pages.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-ios-subhead text-muted-foreground">Facebook Pages</label>
        <div className="flex items-center gap-3">
          {onRefresh && pages.length > 0 && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="text-ios-caption text-primary flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
          {pages.length > 1 && (
            <button
              onClick={selectAll}
              className="text-ios-caption text-primary"
            >
              {selectedPageIds.length === pages.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
      </div>
      
      {pages.length === 0 ? (
        <button
          onClick={onConnectNew}
          disabled={loading}
          className="ios-card p-4 w-full flex items-center gap-3 hover:bg-secondary/50 transition-colors"
        >
          <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
            <Facebook className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-ios-body text-foreground">Connect Facebook Page</p>
            <p className="text-ios-caption text-muted-foreground">
              Required to publish posts
            </p>
          </div>
          <Plus className="w-5 h-5 text-primary" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="ios-card divide-y divide-border">
            {pages.map((page) => {
              const isSelected = selectedPageIds.includes(page.id);
              return (
                <button
                  key={page.id}
                  onClick={() => togglePage(page.id)}
                  className={`p-4 w-full flex items-center gap-3 transition-colors ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'
                  }`}
                >
                  <div className="w-10 h-10 bg-[#1877F2] rounded-lg flex items-center justify-center">
                    <Facebook className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-ios-body text-foreground">{page.page_name}</p>
                    <p className="text-ios-caption text-muted-foreground">
                      ID: {page.page_id}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          
          {selectedPageIds.length > 0 && (
            <p className="text-ios-caption text-muted-foreground px-1">
              {selectedPageIds.length} page{selectedPageIds.length > 1 ? 's' : ''} selected
            </p>
          )}
          
          <button
            onClick={onConnectNew}
            disabled={loading}
            className="text-ios-subhead text-primary flex items-center gap-1 px-1"
          >
            <Plus className="w-4 h-4" />
            Connect Another Page
          </button>
        </div>
      )}
    </div>
  );
}
