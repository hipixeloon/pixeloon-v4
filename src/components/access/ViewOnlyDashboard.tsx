import { Eye, Lock, Video, Calendar } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequestAccessForm } from './RequestAccessForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ViewOnlyDashboard() {
  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* View-only notice */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
          <Eye className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium">View-Only Access</p>
            <p className="text-sm text-muted-foreground">
              You can browse the platform but need creator permissions to create campaigns.
            </p>
          </div>
        </div>

        {/* What you can do */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Browse existing campaigns and see how the platform works.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="w-4 h-4" />
                Explore Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                See videos from connected Google Drive folders.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                View Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Check scheduled posts and posting history.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* What you can't do */}
        <div className="grid md:grid-cols-3 gap-4 opacity-60">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                Create Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Requires creator permission</CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                Connect Facebook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Requires creator permission</CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                Schedule Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Requires creator permission</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Request Access Form */}
        <div className="pt-4">
          <RequestAccessForm />
        </div>
      </div>
    </AppLayout>
  );
}
