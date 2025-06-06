#!/bin/bash

# Test Deployment Script for Observatory Booking App
# This script simulates the Vercel deployment process locally

set -e

echo "🚀 Testing Observatory Booking App Deployment Process"
echo "=================================================="

# Change to project root
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"

# Test the Vercel build command
echo "🔨 Testing Vercel build command..."
cd apps/frontend

echo "📦 Installing dependencies..."
npm ci

echo "🏗️ Building application..."
npm run build

echo "✅ Build completed successfully!"

# Verify build output
echo "📋 Verifying build output..."
if [ -d "build" ]; then
    echo "✅ Build directory exists"
    if [ -f "build/index.html" ]; then
        echo "✅ index.html exists"
    else
        echo "❌ index.html missing"
        exit 1
    fi
    if [ -d "build/static" ]; then
        echo "✅ Static assets directory exists"
    else
        echo "❌ Static assets directory missing"
        exit 1
    fi
else
    echo "❌ Build directory does not exist"
    exit 1
fi

echo ""
echo "🎉 Deployment test completed successfully!"
echo "Your app is ready to deploy to Vercel."
echo ""
echo "Next steps:"
echo "1. Deploy your backend API first"
echo "2. Update REACT_APP_API_URL in vercel.json with your backend URL"
echo "3. Deploy to Vercel using the dashboard or CLI"
echo "4. See VERCEL-DEPLOYMENT.md for detailed instructions"
