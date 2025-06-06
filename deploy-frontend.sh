#!/bin/bash

# Observatory Booking App - Frontend Deployment Script
# This script handles the deployment to Vercel with the correct configuration

echo "🚀 Starting Observatory Booking App deployment..."

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -d "apps/frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Build the frontend
echo "🔨 Building frontend..."
npm run build:frontend

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "✅ Frontend build successful!"

# Deploy with specific configuration
echo "🌐 Deploying to Vercel..."

# Deploy with custom settings to avoid auto-detection issues
vercel deploy \
    --name "observatory-booking-frontend" \
    --build-env NODE_ENV=production \
    --build-env REACT_APP_API_URL="https://your-backend-api.com/api" \
    --build-env SKIP_PREFLIGHT_CHECK=true \
    --build-env DISABLE_ESLINT_PLUGIN=true \
    --output-directory "apps/frontend/build" \
    --build-command "npm run build:frontend" \
    --install-command "npm install" \
    --prod

if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
    echo "📋 Next steps:"
    echo "   1. Update REACT_APP_API_URL in your environment variables"
    echo "   2. Configure your backend API endpoint"
    echo "   3. Test the deployment"
else
    echo "❌ Deployment failed!"
    echo "💡 Try setting the Root Directory to 'apps/frontend' in Vercel dashboard"
    exit 1
fi
