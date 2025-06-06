# Observatory Booking App - Vercel Deployment Guide

## 🚨 **IMPORTANT: Fixing Infinite Build Loop**

If Vercel is looping and trying to build both frontend and backend, follow these steps:

### Step 1: Configure Project Settings in Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **General**
3. Set these configurations:

**Build & Output Settings:**
- **Framework Preset**: `Other`
- **Root Directory**: Leave empty (use repository root)
- **Build Command**: `cd apps/frontend && npm install && npm run build`
- **Output Directory**: `apps/frontend/build`
- **Install Command**: Leave empty or set to `echo "Custom build"`

### Step 2: Environment Variables

Add these in **Settings** → **Environment Variables**:

```
NODE_ENV=production
REACT_APP_API_URL=https://your-backend-api.com/api
SKIP_PREFLIGHT_CHECK=true
DISABLE_ESLINT_PLUGIN=true
```

**⚠️ Replace `https://your-backend-api.com/api` with your actual backend URL**

### Step 3: Ignored Paths

Ensure your `.vercelignore` file excludes:
- Root `package.json`
- Backend directories
- All non-frontend code

### Alternative Solution: Deploy from Subdirectory

If the loop continues, try deploying directly from the frontend folder:

1. In Vercel Dashboard, set **Root Directory** to: `apps/frontend`
2. Change **Build Command** to: `npm install && npm run build`
3. Change **Output Directory** to: `build`

## 🚀 Deployment Steps

### Prerequisites

- Vercel account
- Backend API deployed separately (required!)
- Git repository

### Method 1: Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure as described in Step 1 above
4. Add environment variables from Step 2
5. Deploy

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy with custom settings
vercel --build-env NODE_ENV=production --build-env REACT_APP_API_URL=https://your-api.com/api
```

## 🔧 Troubleshooting Build Loops

### Problem: Vercel keeps building backend
**Solution**: Ensure `.vercelignore` excludes all backend files and root `package.json`

### Problem: Multiple package.json detected
**Solution**: Set Root Directory to `apps/frontend` in Vercel settings

### Problem: Dependencies not installing
**Solution**: Use full install command: `cd apps/frontend && npm install && npm run build`

### Problem: Environment variables not working
**Solution**: Set them in both Vercel dashboard AND in `vercel.json` build.env

## 📁 Expected File Structure for Deployment

```
apps/frontend/
├── package.json          ← This should be the main package.json for build
├── src/
├── public/
└── build/               ← Generated during deployment
```

## 🎯 Key Points

1. **Frontend Only**: This deploys ONLY the React frontend
2. **Backend Separate**: Deploy backend to Railway, Render, or similar
3. **API URL**: Must be set correctly in environment variables
4. **No Monorepo**: Vercel treats this as a single React app

## 📞 Emergency Fix

If still looping, try this minimal `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "cd apps/frontend && npm install && npm run build",
  "outputDirectory": "apps/frontend/build",
  "installCommand": null
}
```

Then redeploy.
