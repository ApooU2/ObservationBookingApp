#!/bin/bash

# Final deployment test script
echo "🔍 Testing Observatory Booking App deployment configuration..."

# Check project structure
echo "📁 Checking project structure..."
if [ -d "apps/frontend" ]; then
    echo "✅ Frontend directory exists"
else
    echo "❌ Frontend directory missing"
    exit 1
fi

if [ -d "apps/frontend/build" ]; then
    echo "✅ Build directory exists"
else
    echo "⚠️  Build directory missing - running build..."
    npm run build:frontend
fi

# Check configuration files
echo "📋 Checking configuration files..."
if [ -f "vercel.json" ]; then
    echo "✅ vercel.json exists"
else
    echo "❌ vercel.json missing"
    exit 1
fi

if [ -f ".vercelignore" ]; then
    echo "✅ .vercelignore exists"
else
    echo "❌ .vercelignore missing"
    exit 1
fi

# Check environment configuration
echo "🔧 Checking environment configuration..."
if [ -f "apps/frontend/.env.production" ]; then
    echo "✅ Production environment file exists"
else
    echo "⚠️  Production environment file missing"
fi

# Test build process
echo "🔨 Testing build process..."
if npm run build:frontend; then
    echo "✅ Build process successful"
else
    echo "❌ Build process failed"
    exit 1
fi

# Final instructions
echo ""
echo "🎯 DEPLOYMENT INSTRUCTIONS:"
echo "1. Go to your Vercel project dashboard"
echo "2. Settings → General → Root Directory"
echo "3. Set Root Directory to: apps/frontend"
echo "4. Save and redeploy"
echo ""
echo "📋 Key Configuration:"
echo "   Framework: None"
echo "   Build Command: npm run build:frontend"
echo "   Output Directory: apps/frontend/build"
echo "   Root Directory: apps/frontend"
echo ""
echo "🌐 Environment Variables to set in Vercel:"
echo "   NODE_ENV=production"
echo "   REACT_APP_API_URL=https://your-backend-api.com/api"
echo "   SKIP_PREFLIGHT_CHECK=true"
echo "   DISABLE_ESLINT_PLUGIN=true"
echo ""
echo "✨ Configuration is ready for deployment!"
