#!/bin/bash
echo "🔭 Building Observatory Booking App for Production"
echo "=================================================="

# Build backend
echo "Building backend..."
cd backend && npm run build && cd ..

# Build frontend
echo "Building frontend..."
cd frontend && npm run build && cd ..

# Sync mobile app
echo "Syncing mobile app..."
cd mobile && npx cap sync && cd ..

echo "✅ Build complete!"
