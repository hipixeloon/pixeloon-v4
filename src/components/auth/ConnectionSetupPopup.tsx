import React from 'react';
import { Facebook, Instagram, Youtube, AlertCircle, ChevronRight, Zap, ShieldCheck, Plus, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/IOSButton';
import { cn } from '@/lib/utils';

interface ConnectionSetupPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectFacebook: () => void;
  onConnectYouTube: () => void;
  onConnectGemini: () => void;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasYouTube: boolean;
  hasGeminiKey: boolean;
}

interface ConnectionItemProps {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  isConnected: boolean;
  onClick: () => void;
  description: string;
}

export function ConnectionSetupPopup({
  isOpen,
  onClose,
  onConnectFacebook,
  onConnectYouTube,
  onConnectGemini,
  hasFacebook,
  hasInstagram,
  hasYouTube,
  hasGeminiKey,
}: ConnectionSetupPopupProps) {
  const isAllConnected = hasFacebook && hasInstagram && hasYouTube && hasGeminiKey;

  if (isAllConnected) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background/80 ios-blur border-none rounded-[32px] p-0 overflow-hidden shadow-2xl">
        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-3 text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center animate-pulse">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Complete Your Setup</DialogTitle>
            <DialogDescription className="text-ios-body text-muted-foreground px-4">
              Connect your social media accounts and AI keys to unlock automated posting and strategy generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Facebook Connection */}
            <ConnectionItem
              label="Facebook & Instagram"
              icon={<Facebook className="w-5 h-5 text-white" />}
              iconBg="bg-[#1877F2]"
              isConnected={hasFacebook || hasInstagram}
              onClick={onConnectFacebook}
              description={hasFacebook ? "Successfully connected!" : "Required for Reels & Pages"}
            />

            {/* YouTube Connection */}
            <ConnectionItem
              label="YouTube Shorts"
              icon={<Youtube className="w-5 h-5 text-white" />}
              iconBg="bg-[#FF0000]"
              isConnected={hasYouTube}
              onClick={onConnectYouTube}
              description={hasYouTube ? "Successfully connected!" : "Schedule Shorts automatically"}
            />

            {/* Gemini Connection */}
            <ConnectionItem
              label="AI Content Generation"
              icon={<Sparkles className="w-5 h-5 text-white" />}
              iconBg="bg-gradient-to-tr from-blue-500 to-purple-600"
              isConnected={hasGeminiKey}
              onClick={onConnectGemini}
              description={hasGeminiKey ? "Gemini API is ready!" : "Enable AI captions and Muse chat"}
            />
          </div>

          <div className="bg-secondary/30 rounded-2xl p-4 flex gap-3 items-start border border-border/50">
            <ShieldCheck className="w-5 h-5 text-ios-green shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secure Integration</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                We only use official APIs. Your passwords and API keys are stored securely and never shared.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <IOSButton fullWidth size="lg" onClick={onClose} className="h-14 text-lg">
              Check Dashboard
            </IOSButton>
            <button 
              onClick={onClose}
              className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Configure Later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionItem({ label, icon, iconBg, isConnected, onClick, description }: ConnectionItemProps) {
  return (
    <button
      onClick={!isConnected ? onClick : undefined}
      disabled={isConnected}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300",
        isConnected 
          ? "bg-ios-green/5 border-ios-green/20" 
          : "bg-secondary/40 border-border/50 hover:bg-secondary/60 hover:scale-[1.02] active:scale-95"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", iconBg)}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={cn("text-sm font-bold", isConnected ? "text-ios-green" : "text-foreground")}>
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {description}
        </p>
      </div>
      {isConnected ? (
        <div className="w-6 h-6 bg-ios-green rounded-full flex items-center justify-center">
          <ChevronRight className="w-3 h-3 text-white" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </div>
      )}
    </button>
  );
}
