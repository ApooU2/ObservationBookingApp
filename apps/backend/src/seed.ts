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
        name: 'Meade 16-inch LX200 ACF',
        description: 'Professional 16-inch Advanced Coma-Free telescope with f/10 optics. Features GPS alignment, AutoStar II controller, and Zero Image-Shift Microfocuser. Perfect for advanced research and astrophotography with coma-free pinpoint star images.',
        specifications: {
          aperture: '16 inches (406mm)',
          focalLength: '4064mm (f/10)',
          mountType: 'LX200 Fork Mount with GPS',
          accessories: [
            'AutoStar II Controller (145,000 object database)',
            'Zero Image-Shift Microfocuser',
            'Primary Mirror Lock',
            'SmartDrive PPEC',
            'Ultra-High Transmission Coatings (UHTC)',
            'GPS Receiver',
            'AutoAlign System'
          ]
        },
        location: 'Observatory Dome #1',
        isActive: true,
        maintenanceSchedule: new Date('2025-06-15')
      },
      {
        name: 'Sky-Watcher Classic 250P Dobsonian',
        description: 'High-quality 10-inch Dobsonian telescope with Newtonian design and f/4.7 optics. Features parabolic primary mirror with RAQ coatings (94% reflectivity), 2-inch Crayford focuser, and heavy-duty rocker box. Ideal for visual astronomy and deep sky observation.',
        specifications: {
          aperture: '10 inches (254mm)',
          focalLength: '1200mm (f/4.7)',
          mountType: 'Dobsonian Rocker Box with Teflon Bearings',
          accessories: [
            '9x50 Finderscope',
            '25mm Super Eyepiece (48x magnification)',
            '10mm Super Eyepiece (120x magnification)',
            '2-inch Crayford Focuser',
            '1.25-inch Adapter',
            'Tension Control Handle',
            'Parabolic Primary Mirror with RAQ Coatings'
          ]
        },
        location: 'Observatory Dome #2',
        isActive: true,
        maintenanceSchedule: new Date('2025-08-20')
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
