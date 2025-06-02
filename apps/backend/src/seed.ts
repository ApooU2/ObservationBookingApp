import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Telescope } from './models/Telescope';

dotenv.config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/observatory-booking';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Telescope.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUser = new User({
      name: 'Observatory Admin',
      email: 'admin@observatory.com',
      password: adminPassword,
      role: 'admin',
      isVerified: true,
      phone: '+1-555-0100'
    });
    await adminUser.save();
    console.log('Created admin user');

    // Create test user
    const userPassword = await bcrypt.hash('user123', 12);
    const testUser = new User({
      name: 'John Stargazer',
      email: 'user@example.com',
      password: userPassword,
      role: 'user',
      isVerified: true,
      phone: '+1-555-0101'
    });
    await testUser.save();
    console.log('Created test user');

    // Create telescopes
    const telescopes = [
      {
        name: 'Celestron Schmidt-Cassegrain',
        description: 'Professional 14-inch Schmidt-Cassegrain telescope perfect for deep sky observation and astrophotography. Features advanced computerized mount with GPS alignment.',
        specifications: {
          aperture: '14 inches (356mm)',
          focalLength: '3910mm',
          mountType: 'CGE Pro Computerized',
          accessories: ['Eyepieces (25mm, 10mm)', 'Camera adapter', 'Finder scope', 'Laptop mount']
        },
        location: 'Observatory Dome #1',
        isActive: true
      },
      {
        name: 'Meade LX200 Refractor',
        description: 'High-quality 8-inch refractor telescope ideal for planetary observation and lunar photography. Excellent for beginners and experienced astronomers alike.',
        specifications: {
          aperture: '8 inches (203mm)',
          focalLength: '2032mm',
          mountType: 'LX200 Motorized Fork',
          accessories: ['Eyepiece set', 'Solar filter', 'Barlow lens', 'CCD camera']
        },
        location: 'Observatory Dome #2',
        isActive: true,
        maintenanceSchedule: new Date('2025-07-15')
      }
    ];

    for (const telescopeData of telescopes) {
      const telescope = new Telescope(telescopeData);
      await telescope.save();
    }
    console.log('Created telescopes');

    console.log('\n=== SEED DATA COMPLETE ===');
    console.log('Admin credentials:');
    console.log('  Email: admin@observatory.com');
    console.log('  Password: admin123');
    console.log('\nTest user credentials:');
    console.log('  Email: user@example.com');
    console.log('  Password: user123');
    console.log('\nTelescopes created:', telescopes.length);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
