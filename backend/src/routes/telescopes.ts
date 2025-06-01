import express from 'express';
import { Telescope } from '../models/Telescope';
import { Booking } from '../models/Booking';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// Get all telescopes
router.get('/', async (req, res) => {
  try {
    const telescopes = await Telescope.find({ isActive: true });
    res.json(telescopes);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get telescope by ID with booking status
router.get('/:id', async (req, res) => {
  try {
    const telescope = await Telescope.findById(req.params.id);
    
    if (!telescope) {
      return res.status(404).json({ error: 'Telescope not found' });
    }

    // Get current and upcoming bookings
    const now = new Date();
    const upcomingBookings = await Booking.find({
      telescope: telescope._id,
      startTime: { $gte: now },
      status: { $in: ['pending', 'confirmed'] }
    }).populate('user', 'name email').sort({ startTime: 1 }).limit(5);

    res.json({
      telescope,
      upcomingBookings
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new telescope (admin only)
router.post('/', requireAdmin, async (req: any, res) => {
  try {
    const telescope = new Telescope(req.body);
    await telescope.save();
    
    res.status(201).json({
      message: 'Telescope created successfully',
      telescope
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update telescope (admin only)
router.put('/:id', requireAdmin, async (req: any, res) => {
  try {
    const telescope = await Telescope.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!telescope) {
      return res.status(404).json({ error: 'Telescope not found' });
    }

    res.json({
      message: 'Telescope updated successfully',
      telescope
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete telescope (admin only)
router.delete('/:id', requireAdmin, async (req: any, res) => {
  try {
    const telescope = await Telescope.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!telescope) {
      return res.status(404).json({ error: 'Telescope not found' });
    }

    res.json({
      message: 'Telescope deactivated successfully',
      telescope
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
