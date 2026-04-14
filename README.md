# Pixeloon - Social Media Campaign Manager

Pixeloon is an automated social media campaign management platform that enables users to schedule and publish video content across Facebook, Instagram, and YouTube with AI-generated captions.

## Features

### Campaign Management
- **Create Campaigns** - Set up campaigns with videos from Google Drive folders or direct links
- **Multi-Platform Publishing** - Post to Facebook Pages, Instagram, and YouTube channels
- **Flexible Scheduling** - Configure multiple post times per day with optional randomization
- **AI-Generated Captions** - Automatically generate engaging captions using Google Gemini AI
- **Customizable Settings** - Control caption length (short/medium/long) and hashtag count (0-20)

### Platform Integrations
- **Facebook/Instagram** - OAuth integration for page management and posting
- **YouTube** - Channel connection with OAuth for video uploads
- **Google Drive** - Direct folder integration for video content

### Admin Panel
- **User Management** - View and manage all users with role-based access
- **Access Requests** - Review and approve/deny user access requests
- **Activity Logs** - Track user actions and system events
- **Subscription Management** - Manage user subscriptions and permissions

### Security
- **Role-Based Access Control** - Admin, Moderator, and User roles
- **Permission System** - Creator and Viewer permissions
- **Row-Level Security** - Supabase RLS policies for data protection

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - UI component library
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Recharts** - Charting library

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Row-Level Security
  - Edge Functions
  - Storage buckets

### AI Integration
- **Google Gemini** - AI caption generation

## Project Structure

```
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── access/         # Access request components
│   │   ├── admin/          # Admin panel components
│   │   ├── auth/           # Authentication components
│   │   ├── campaign/       # Campaign management components
│   │   ├── layout/         # Layout components (Header, Sidebar, AppLayout)
│   │   ├── skeletons/      # Loading skeleton components
│   │   └── ui/             # shadcn/ui components
│   ├── contexts/           # React contexts
│   │   ├── AuthContext.tsx # Authentication state
│   │   └── ThemeContext.tsx# Theme management
│   ├── hooks/              # Custom React hooks
│   │   ├── useAdminPanel.ts
│   │   ├── useAdminUsers.ts
│   │   ├── useAppSettings.ts
│   │   ├── useFacebookPages.ts
│   │   ├── usePermissions.ts
│   │   ├── usePullToRefresh.ts
│   │   └── useUserRoles.ts
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase client and types
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   │   ├── AdminPanel.tsx  # Admin dashboard
│   │   ├── Auth.tsx        # Login/signup page
│   │   ├── CampaignDetail.tsx # Campaign view/edit
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Executions.tsx  # Scheduled posts view
│   │   ├── FacebookCallback.tsx
│   │   ├── Index.tsx       # Landing/redirect page
│   │   ├── NewCampaign.tsx # Campaign creation
│   │   ├── Settings.tsx    # User settings
│   │   └── PrivacyPolicy.tsx
│   └── types/              # TypeScript type definitions
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── auto-poster/    # Automated posting cron job
│   │   ├── facebook-oauth/ # Facebook OAuth handling
│   │   ├── generate-content/ # AI content generation
│   │   ├── generate-schedule/ # Schedule generation
│   │   ├── list-folder-videos/ # Google Drive listing
│   │   ├── validate-drive-links/ # Link validation
│   │   └── test-*/         # Testing functions
│   └── migrations/         # Database migrations
└── tailwind.config.ts      # Tailwind configuration
```

## Database Schema

### Core Tables
- **profiles** - User profile information
- **campaigns** - Campaign configuration and settings
- **scheduled_posts** - Individual scheduled posts with status
- **campaign_pages** - Campaign to Facebook page associations
- **campaign_platforms** - Platform configurations per campaign
- **campaign_post_times** - Posting schedule times

### Authentication & Authorization
- **user_roles** - User role assignments (admin/moderator/user)
- **user_permissions** - Permission grants (creator/viewer)
- **access_requests** - User access request workflow

### Platform Connections
- **facebook_connections** - Facebook OAuth tokens
- **facebook_pages** - Connected Facebook pages
- **instagram_accounts** - Connected Instagram accounts
- **youtube_channels** - Connected YouTube channels

### System
- **app_settings** - Application configuration
- **activity_logs** - User activity tracking
- **api_connection_logs** - API connection status
- **user_subscriptions** - Subscription management
- **user_api_keys** - User API key storage

## Edge Functions

| Function | Purpose |
|----------|---------|
| `auto-poster` | Cron job that processes scheduled posts and publishes to platforms |
| `facebook-oauth` | Handles Facebook OAuth flow and token exchange |
| `generate-content` | Generates AI captions using Google Gemini |
| `generate-schedule` | Creates scheduled posts based on campaign settings |
| `list-folder-videos` | Lists videos from Google Drive folders |
| `validate-drive-links` | Validates Google Drive video links |

## Environment Variables

### Supabase Secrets (Edge Functions)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `FACEBOOK_APP_ID` - Facebook app ID
- `FACEBOOK_APP_SECRET` - Facebook app secret
- `YOUTUBE_CLIENT_ID` - YouTube OAuth client ID
- `YOUTUBE_CLIENT_SECRET` - YouTube OAuth client secret
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Google service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Google service account key
- `GOOGLE_GEMINI_API_KEY` - Gemini API key for AI features

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd pixeloon
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

The app will be available at `http://localhost:8080`

### Supabase Setup

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/`
3. Configure the edge function secrets
4. Deploy edge functions

## Development

### Running Locally
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access - manage users, settings, all data |
| Moderator | View all users, manage access requests |
| User | Access own campaigns and data only |

## Permissions

| Permission | Description |
|------------|-------------|
| Creator | Can create and manage campaigns |
| Viewer | View-only access (no content creation) |

## Deployment

### Deploy with Lovable
1. Open your project in Lovable
2. Click **Share → Publish** in the top right
3. Your app will be live at `yourproject.lovable.app`

### Self-Hosting
The project can be deployed to any static hosting service:

```bash
npm run build
```

Deploy the `dist` folder to Vercel, Netlify, Cloudflare Pages, or any static hosting provider.

## License

This project is proprietary software.

## Support

For support, please contact the Pixeloon team.
