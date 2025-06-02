# Observatory Booking App - Vercel Deployment Guide

## 🚀 Deployment Steps

This guide will help you deploy the Observatory Booking App frontend to Vercel.

### 1. Prerequisites

- Vercel account (sign up at [vercel.com](https://vercel.com))
- Git repository with your code
- Backend API deployed separately (required for the frontend to function)

### 2. Backend Deployment (First)

⚠️ **Important**: You must deploy the backend API first, as the frontend needs to connect to it.

The backend can be deployed to:
- Railway
- Render
- DigitalOcean App Platform
- AWS/Google Cloud/Azure
- Any Node.js hosting service

Make note of your backend API URL (e.g., `https://your-backend.railway.app/api`)

### 3. Vercel Deployment

#### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure the project:
   - **Framework Preset**: Other (or None)
   - **Root Directory**: Leave empty (use repository root)
   - **Build Command**: `cd apps/frontend && npm ci && npm run build`
   - **Output Directory**: `apps/frontend/build`
   - **Install Command**: `echo 'Dependencies installed in build command'`

4. Add Environment Variables:
   ```
   NODE_ENV=production
   REACT_APP_API_URL=https://your-backend-api.com/api
   ```
   ⚠️ Replace `https://your-backend-api.com/api` with your actual backend API URL

5. Click "Deploy"

#### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. In your project root, run:
   ```bash
   vercel
   ```

4. Follow the prompts and configure as described in Option A

### 4. Configuration Notes

- The `vercel.json` file is already configured for this React app
- It includes proper routing for single-page applications
- Static assets are cached for optimal performance
- The build excludes unnecessary files via `.vercelignore`

### 5. Environment Variables

Update the `REACT_APP_API_URL` environment variable in Vercel dashboard:

1. Go to your project on Vercel
2. Navigate to Settings → Environment Variables
3. Update `REACT_APP_API_URL` with your backend URL
4. Redeploy the project

### 6. Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Navigate to Domains
3. Add your custom domain
4. Update DNS records as instructed

### 7. Troubleshooting

#### Build Failures
- Check that `apps/frontend/package.json` exists
- Verify all dependencies are properly listed
- Check build logs for specific errors

#### Runtime Issues
- Verify `REACT_APP_API_URL` is set correctly
- Check browser console for network errors
- Ensure backend API is accessible and CORS is configured

#### Routing Issues
- The `vercel.json` includes rewrites for React Router
- All routes should redirect to `index.html` for client-side routing

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Create React App Deployment](https://create-react-app.dev/docs/deployment/)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

## 📞 Support

If you encounter issues, check:
1. Vercel build logs
2. Browser developer console
3. Network tab for API requests
4. Backend API health endpoints
