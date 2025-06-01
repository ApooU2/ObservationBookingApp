#!/usr/bin/env python3
"""
Observatory Booking App - Deployment Utility
A Python script to help with deployment tasks across different platforms
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path
from typing import Dict, List, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ObservatoryDeployer:
    """Main deployment class for Observatory Booking App"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root / "frontend"
        self.mobile_dir = self.project_root / "mobile"
        self.wordpress_dir = self.project_root / "wordpress-plugin"
        
    def run_command(self, command: List[str], cwd: Path = None) -> bool:
        """Execute a shell command and return success status"""
        try:
            result = subprocess.run(
                command, 
                cwd=cwd or self.project_root, 
                check=True, 
                capture_output=True, 
                text=True
            )
            logger.info(f"✅ Command succeeded: {' '.join(command)}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Command failed: {' '.join(command)}")
            logger.error(f"Error: {e.stderr}")
            return False
    
    def check_dependencies(self) -> bool:
        """Check if all required dependencies are installed"""
        logger.info("🔍 Checking dependencies...")
        
        dependencies = [
            ("node", ["node", "--version"]),
            ("npm", ["npm", "--version"]),
            ("git", ["git", "--version"])
        ]
        
        all_ok = True
        for name, command in dependencies:
            if not self.run_command(command):
                logger.error(f"❌ {name} is not installed or not in PATH")
                all_ok = False
            
        return all_ok
    
    def install_dependencies(self) -> bool:
        """Install all Node.js dependencies"""
        logger.info("📦 Installing dependencies...")
        
        dirs_to_install = [
            (self.project_root, "root"),
            (self.backend_dir, "backend"),
            (self.frontend_dir, "frontend"),
            (self.mobile_dir, "mobile")
        ]
        
        for directory, name in dirs_to_install:
            logger.info(f"Installing {name} dependencies...")
            if not self.run_command(["npm", "install"], cwd=directory):
                return False
                
        return True
    
    def build_backend(self) -> bool:
        """Build the backend TypeScript code"""
        logger.info("🏗️  Building backend...")
        return self.run_command(["npm", "run", "build"], cwd=self.backend_dir)
    
    def build_frontend(self) -> bool:
        """Build the frontend React app"""
        logger.info("🏗️  Building frontend...")
        return self.run_command(["npm", "run", "build"], cwd=self.frontend_dir)
    
    def sync_mobile(self) -> bool:
        """Sync mobile app with latest frontend build"""
        logger.info("📱 Syncing mobile app...")
        
        # Copy frontend build to mobile www directory
        frontend_build = self.frontend_dir / "build"
        mobile_www = self.mobile_dir / "www"
        
        if not frontend_build.exists():
            logger.error("❌ Frontend build not found. Run build_frontend first.")
            return False
        
        # Remove existing www content
        if mobile_www.exists():
            self.run_command(["rm", "-rf", str(mobile_www)])
        
        # Copy frontend build
        if not self.run_command(["cp", "-r", str(frontend_build), str(mobile_www)]):
            return False
        
        # Run Capacitor sync
        return self.run_command(["npx", "cap", "sync"], cwd=self.mobile_dir)
    
    def create_wordpress_package(self) -> bool:
        """Create a WordPress plugin package"""
        logger.info("📦 Creating WordPress plugin package...")
        
        package_dir = self.project_root / "dist" / "wordpress-plugin"
        package_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy plugin files
        plugin_files = [
            "observatory-booking.php",
            "assets/",
            "README.txt"
        ]
        
        for file_pattern in plugin_files:
            source = self.wordpress_dir / file_pattern
            if source.exists():
                if source.is_dir():
                    self.run_command(["cp", "-r", str(source), str(package_dir)])
                else:
                    self.run_command(["cp", str(source), str(package_dir)])
        
        # Create zip package
        zip_name = f"observatory-booking-plugin-v1.0.0.zip"
        zip_path = self.project_root / "dist" / zip_name
        
        return self.run_command([
            "zip", "-r", str(zip_path), ".",
            "-x", "*.git*", "node_modules/*", "*.DS_Store"
        ], cwd=package_dir)
    
    def deploy_to_server(self, server_config: Dict) -> bool:
        """Deploy to a remote server using SSH"""
        logger.info(f"🚀 Deploying to {server_config.get('host', 'server')}...")
        
        # This would implement actual server deployment
        # For now, just a placeholder
        logger.warning("⚠️  Server deployment not implemented yet")
        return True
    
    def run_tests(self) -> bool:
        """Run all tests"""
        logger.info("🧪 Running tests...")
        
        test_commands = [
            (self.backend_dir, ["npm", "test"]),
            (self.frontend_dir, ["npm", "test", "--", "--watchAll=false"])
        ]
        
        all_passed = True
        for directory, command in test_commands:
            if not self.run_command(command, cwd=directory):
                all_passed = False
                
        return all_passed
    
    def full_build(self) -> bool:
        """Perform a full build of all components"""
        logger.info("🏗️  Starting full build process...")
        
        steps = [
            ("Checking dependencies", self.check_dependencies),
            ("Installing dependencies", self.install_dependencies),
            ("Building backend", self.build_backend),
            ("Building frontend", self.build_frontend),
            ("Syncing mobile app", self.sync_mobile),
            ("Creating WordPress package", self.create_wordpress_package)
        ]
        
        for step_name, step_func in steps:
            logger.info(f"📋 {step_name}...")
            if not step_func():
                logger.error(f"❌ Failed at step: {step_name}")
                return False
        
        logger.info("✅ Full build completed successfully!")
        return True

def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(description="Observatory Booking App Deployment Utility")
    parser.add_argument("action", choices=[
        "check", "install", "build", "build-backend", "build-frontend", 
        "sync-mobile", "package-wp", "test", "full-build"
    ], help="Action to perform")
    
    parser.add_argument("--project-root", help="Project root directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    deployer = ObservatoryDeployer(args.project_root)
    
    actions = {
        "check": deployer.check_dependencies,
        "install": deployer.install_dependencies,
        "build": deployer.full_build,
        "build-backend": deployer.build_backend,
        "build-frontend": deployer.build_frontend,
        "sync-mobile": deployer.sync_mobile,
        "package-wp": deployer.create_wordpress_package,
        "test": deployer.run_tests,
        "full-build": deployer.full_build
    }
    
    action_func = actions.get(args.action)
    if action_func:
        success = action_func()
        sys.exit(0 if success else 1)
    else:
        logger.error(f"Unknown action: {args.action}")
        sys.exit(1)

if __name__ == "__main__":
    main()
