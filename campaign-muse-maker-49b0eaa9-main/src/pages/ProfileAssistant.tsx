import React, { useState } from 'react';
import { Sparkles, Loader2, Copy, Check, Globe, Zap, MessageSquare, ChevronRight, Hash, UserCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { IOSButton } from '@/components/ui/IOSButton';
import { IOSInput } from '@/components/ui/IOSInput';
import { IOSTextarea } from '@/components/ui/IOSTextarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProfileStrategy {
  usernames: string[];
  instagramBios: string[];
  facebookBios: string[];
  youtubeBios: string[];
  brandingToneSuggestions: string[];
  hookStyles: string[];
}

export default function ProfileAssistant() {
  const [niche, setNiche] = useState('');
  const [tone, setTone] = useState('excited');
  const [country, setCountry] = useState('India');
  const [referenceText, setReferenceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<ProfileStrategy | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!niche.trim()) {
      toast({ title: 'Niche is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setStrategy(null);

    try {
      const { data, error } = await supabase.functions.invoke('profile-assistant', {
        body: { niche, tone, country, referenceText }
      });

      if (error || data.error) throw new Error(data?.error || error?.message || 'Failed to generate');

      setStrategy(data.data);
      toast({ title: 'Strategy Generated!', description: 'Your AI branding plan is ready.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Generation Failed', description: err instanceof Error ? err.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AppLayout title="Profile Assistant">
      <div className="p-4 space-y-6 pb-20">
        {/* Input Form */}
        <section className="space-y-4">
          <Card className="border-none shadow-none bg-secondary/30 rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="w-5 h-5" />
                <CardTitle className="text-lg">AI Branding Wizard</CardTitle>
              </div>
              <CardDescription>Tell us about your brand and let AI design your identity.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <IOSInput 
                label="What is your niche?" 
                placeholder="e.g. Luxury Watches, Tech Reviews, Cooking" 
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Globe className="w-3 h-3" /> Target Country
                  </Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="rounded-xl border-none bg-background shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="India">India 🇮🇳</SelectItem>
                      <SelectItem value="USA">USA 🇺🇸</SelectItem>
                      <SelectItem value="UK">UK 🇬🇧</SelectItem>
                      <SelectItem value="Global">Global 🌐</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <Zap className="w-3 h-3" /> Preferred Tone
                  </Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="rounded-xl border-none bg-background shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excited">Excited 🔥</SelectItem>
                      <SelectItem value="professional">Professional 💼</SelectItem>
                      <SelectItem value="funny">Funny 😂</SelectItem>
                      <SelectItem value="aggressive">Aggressive 😤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <IOSTextarea 
                label="Style Reference (Optional)" 
                placeholder="Paste a bio or text style you like..." 
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                className="min-h-[80px]"
              />

              <IOSButton 
                fullWidth 
                onClick={handleGenerate} 
                disabled={loading}
                className="mt-2 h-12 text-md shadow-lg shadow-primary/20"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Strategy</>}
              </IOSButton>
            </CardContent>
          </Card>
        </section>

        {/* Results */}
        {strategy && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Usernames */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 px-1 text-ios-headline font-bold">
                <UserCircle className="w-5 h-5 text-ios-blue" />
                Username Ideas
              </h3>
              <div className="flex flex-wrap gap-2">
                {strategy.usernames.map((u, i) => (
                  <button 
                    key={i} 
                    onClick={() => copyToClipboard(u, `u-${i}`)}
                    className="px-4 py-2 bg-background border rounded-full text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    {u}
                    {copiedId === `u-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground opacity-50" />}
                  </button>
                ))}
              </div>
            </section>

            {/* Bios */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 px-1 text-ios-headline font-bold">
                <MessageSquare className="w-5 h-5 text-ios-pink" />
                Platform Bios
              </h3>
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="grid grid-cols-3 w-full rounded-2xl bg-secondary/50 p-1">
                  <TabsTrigger value="instagram" className="rounded-xl">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook" className="rounded-xl">Facebook</TabsTrigger>
                  <TabsTrigger value="youtube" className="rounded-xl">YouTube</TabsTrigger>
                </TabsList>
                {(['instagram', 'facebook', 'youtube'] as const).map((platform) => (
                  <TabsContent key={platform} value={platform} className="space-y-3 mt-4">
                    {strategy[`${platform}Bios` as keyof ProfileStrategy].map((bio, i) => (
                      <div key={i} className="bg-background border rounded-2xl p-4 relative group">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap pr-10">{bio}</p>
                        <button 
                          onClick={() => copyToClipboard(bio as string, `${platform}-${i}`)}
                          className="absolute top-4 right-4 p-2 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                        >
                          {copiedId === `${platform}-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            {/* Branding & Hooks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 px-1 text-ios-headline font-bold">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Branding Tips
                </h3>
                <div className="space-y-2">
                  {strategy.brandingToneSuggestions.map((tip, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-xs font-bold text-primary">{i+1}</div>
                      <p className="text-sm font-medium">{tip}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 px-1 text-ios-headline font-bold">
                  <Hash className="w-5 h-5 text-ios-orange" />
                  Hook Formulas
                </h3>
                <div className="space-y-2">
                  {strategy.hookStyles.map((hook, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                       <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-xs font-bold text-ios-orange">{i+1}</div>
                       <p className="text-sm font-medium italic">"{hook}"</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
