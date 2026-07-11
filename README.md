# Pixeloon - Social Media Campaign Manager

Pixeloon is an automated social media campaign management platform that enables users to schedule and publish video content across Facebook, Instagram, and YouTube with AI-generated captions.

> **🚀 Want it live for free?** Follow **[docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md)** — upload to your GitHub, host on Cloudflare Pages, run the backend on Supabase, and attach a custom domain, all on free tiers.
>
> **📖 Full configuration reference:** **[docs/SETUP.md](docs/SETUP.md)** — Supabase deployment (migrations, edge functions, cron) and the per-user API keys (Gemini, Google Drive service account, Facebook App, YouTube OAuth), with a verification checklist and troubleshooting table.

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

## Configuration

### Frontend environment variables (`.env` locally / Cloudflare Pages env vars)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/publishable key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ref

### Supabase function secrets (deployment-level, optional)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` - logo watermarking on videos
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - folder video-count preview only

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into edge functions automatically.)

### Per-user API keys (each user sets their own in **Settings → API Keys**)
- **Gemini API key** - AI caption generation
- **Google Drive service account** (email + private key) - reading campaign videos; required for posting
- **Facebook App ID + Secret** - Facebook/Instagram OAuth and publishing
- **YouTube OAuth Client ID + Secret** - YouTube uploads

Every user runs on their own keys — nothing is shared between accounts. See [docs/SETUP.md](docs/SETUP.md) Part 2 for exact steps to obtain each key.

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
2. `supabase link --project-ref <ref>` then `supabase db push` (applies all migrations in `supabase/migrations/`)
3. Deploy the edge functions (`supabase functions deploy …`)
4. Create the auto-poster cron job pointing at your project (SQL in [docs/SETUP.md](docs/SETUP.md) §1.3)
5. Optionally set the Cloudinary secrets for watermarking

Full details with copy-paste commands: [docs/SETUP.md](docs/SETUP.md).

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

### Recommended: free stack (GitHub + Cloudflare Pages + Supabase + custom domain)

Follow the step-by-step guide in **[docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md)**:

1. Push this repo to your own GitHub
2. Connect the repo to **Cloudflare Pages** (build `npm run build`, output `dist`, set the `VITE_*` env vars) — every push auto-deploys
3. Run the backend on a free **Supabase** project (migrations + edge functions + cron)
4. Attach your **custom domain** in Cloudflare with automatic HTTPS

### Other static hosts

The frontend is a static Vite build — `npm run build` and deploy the `dist` folder to Vercel, Netlify, or any static host. Set the `VITE_*` environment variables in the host's dashboard, and make sure all routes fall back to `index.html` (a `public/_redirects` file is included for Cloudflare/Netlify).

## License

This project is proprietary software.

## Support

For support, please contact the Pixeloon team.
