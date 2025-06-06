# Observatory Booking App - Vercel Deployment Guide

## Current Issue
Vercel's auto-detection is looking for `/vercel/path0/frontend/package.json` instead of `/vercel/path0/apps/frontend/package.json`, causing deployment failures.

## Solution Options

### Option 1: Manual Root Directory Configuration (RECOMMENDED)
1. Go to your Vercel project dashboard
2. Go to Settings → General
3. Set **Root Directory** to `apps/frontend`
4. Save and redeploy

This bypasses all auto-detection issues and forces Vercel to treat `apps/frontend` as the project root.

### Option 2: Use the Custom Deployment Script
Run the deployment script from the project root:
```bash
./deploy-frontend.sh
```

### Option 3: Use vercel.json Configuration
The current `vercel.json` is configured to:
- Use `npm run build:frontend` as build command
- Output to `apps/frontend/build`
- Handle React Router correctly with rewrites

## Verification Steps
1. Build works locally: ✅ `npm run build:frontend`
2. Output directory correct: ✅ `apps/frontend/build`
3. Environment variables set: ✅ Production config ready
4. Ignore files configured: ✅ `.vercelignore` excludes backend

## Environment Variables
Make sure these are set in Vercel dashboard:
- `NODE_ENV=production`
- `REACT_APP_API_URL=https://your-backend-api.com/api`
- `SKIP_PREFLIGHT_CHECK=true`
- `DISABLE_ESLINT_PLUGIN=true`

## Final Configuration
- **Framework:** None (React CRA)
- **Build Command:** `npm run build:frontend`
- **Output Directory:** `apps/frontend/build`
- **Install Command:** `npm install`
- **Root Directory:** `apps/frontend` (SET THIS IN DASHBOARD)

## Next Steps
1. Set Root Directory to `apps/frontend` in Vercel dashboard
2. Redeploy the project
3. Update `REACT_APP_API_URL` with your actual backend URL
4. Test the deployment
