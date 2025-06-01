#!/bin/bash

# Observatory Booking App - Development Environment Setup
# This script sets up the development environment for all components

set -e

echo "🔭 Observatory Booking App - Environment Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_status "Node.js version: $(node --version) ✓"
}

# Check if Python is installed (for deployment scripts)
check_python() {
    if command -v python3 &> /dev/null; then
        print_status "Python3 is available: $(python3 --version)"
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_VERSION=$(python --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1)
        if [ "$PYTHON_VERSION" = "3" ]; then
            print_status "Python3 is available: $(python --version)"
            PYTHON_CMD="python"
        else
            print_warning "Python3 not found. Some deployment features may not work."
            return
        fi
    else
        print_warning "Python not found. Some deployment features may not work."
        return
    fi
}

# Create Python virtual environment for deployment scripts
setup_python_venv() {
    if [ -n "$PYTHON_CMD" ]; then
        print_step "Setting up Python virtual environment..."
        
        if [ ! -d "venv" ]; then
            $PYTHON_CMD -m venv venv
            print_status "Created Python virtual environment"
        else
            print_status "Python virtual environment already exists"
        fi
        
        # Activate virtual environment and install basic packages
        source venv/bin/activate
        pip install --upgrade pip
        
        # Create requirements.txt for deployment tools
        cat > requirements.txt << EOF
# Deployment and utility tools
requests>=2.31.0
python-dotenv>=1.0.0
pyyaml>=6.0
click>=8.1.0
jinja2>=3.1.0
paramiko>=3.3.0
fabric>=3.2.0
EOF
        
        pip install -r requirements.txt
        print_status "Installed Python deployment tools"
        deactivate
    fi
}

# Install Node.js dependencies
install_node_dependencies() {
    print_step "Installing Node.js dependencies..."
    
    # Root dependencies
    print_status "Installing root dependencies..."
    npm install
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    # Mobile dependencies
    print_status "Installing mobile dependencies..."
    cd mobile
    npm install
    cd ..
    
    print_status "All Node.js dependencies installed ✓"
}

# Create environment files
setup_environment_files() {
    print_step "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_status "Created backend/.env from template"
        print_warning "Please update backend/.env with your actual configuration"
    else
        print_status "Backend .env file already exists"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_APP_NAME=Observatory Booking App
REACT_APP_VERSION=1.0.0
EOF
        print_status "Created frontend/.env"
    else
        print_status "Frontend .env file already exists"
    fi
}

# Setup database
setup_database() {
    print_step "Database setup..."
    print_warning "Make sure MongoDB is running before proceeding"
    
    read -p "Do you want to seed the database with sample data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Seeding database..."
        cd backend
        npm run seed
        cd ..
        print_status "Database seeded with sample data ✓"
    fi
}

# Create development scripts
create_dev_scripts() {
    print_step "Creating development scripts..."
    
    # Create a start script
    cat > start-dev.sh << 'EOF'
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
EOF
    
    chmod +x start-dev.sh
    print_status "Created start-dev.sh script"
    
    # Create a build script
    cat > build-all.sh << 'EOF'
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
EOF
    
    chmod +x build-all.sh
    print_status "Created build-all.sh script"
}

# Main setup function
main() {
    print_step "Starting environment setup..."
    
    check_node
    check_python
    setup_python_venv
    install_node_dependencies
    setup_environment_files
    create_dev_scripts
    
    print_step "Setup complete! 🎉"
    echo ""
    echo "Next steps:"
    echo "1. Update backend/.env with your MongoDB URI and email settings"
    echo "2. Start MongoDB: brew services start mongodb/brew/mongodb-community"
    echo "3. Seed the database: cd backend && npm run seed"
    echo "4. Start development: ./start-dev.sh"
    echo ""
    echo "Available scripts:"
    echo "  ./start-dev.sh     - Start development environment"
    echo "  ./build-all.sh     - Build for production"
    echo "  npm run dev        - Start backend and frontend"
    echo "  npm run build      - Build all components"
    echo ""
    print_status "Happy coding! 🚀"
}

# Run main function
main "$@"
