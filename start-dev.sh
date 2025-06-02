#!/bin/bash
echo "🔭 Starting Observatory Booking App Development Environment"
echo "=========================================================="

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    echo "   brew services start mongodb/brew/mongodb-community (macOS with Homebrew)"
    echo "   or start it manually"
    exit 1
fi

# Start the development servers
npm run dev
