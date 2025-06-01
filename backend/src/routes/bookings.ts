import express from 'express';
import { body, validationResult } from 'express-validator';
import moment from 'moment';
import { Booking } from '../models/Booking';
import { Telescope } from '../models/Telescope';
import emailService from '../services/emailService';

const router = express.Router();

// Get all bookings for a user
router.get('/', async (req: any, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('telescope', 'name location')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available time slots for a telescope
router.get('/available/:telescopeId', async (req, res) => {
  try {
    const { telescopeId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const startOfDay = moment(date as string).startOf('day').toDate();
    const endOfDay = moment(date as string).endOf('day').toDate();

    // Get existing bookings for the day
    const existingBookings = await Booking.find({
      telescope: telescopeId,
      status: { $in: ['pending', 'confirmed'] },
      startTime: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ startTime: 1 });

    // Generate available slots (assuming 1-hour slots from 6 PM to 6 AM)
    const availableSlots = [];
    const timeSlots = [
      '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
      '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'
    ];

    for (const time of timeSlots) {
      const slotStart = moment(date as string).set({
        hour: parseInt(time.split(':')[0]),
        minute: parseInt(time.split(':')[1]),
        second: 0
      });

      // If it's past midnight, add a day
      if (parseInt(time.split(':')[0]) < 12) {
        slotStart.add(1, 'day');
      }

      const slotEnd = slotStart.clone().add(1, 'hour');

      // Check if slot conflicts with existing booking
      const isBooked = existingBookings.some(booking => {
        const bookingStart = moment(booking.startTime);
        const bookingEnd = moment(booking.endTime);
        return slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart);
      });

      if (!isBooked && slotStart.isAfter(moment())) {
        availableSlots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          display: slotStart.format('HH:mm') + ' - ' + slotEnd.format('HH:mm')
        });
      }
    }

    res.json(availableSlots);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new booking
router.post('/', [
  body('telescope').notEmpty().withMessage('Telescope ID required'),
  body('startTime').isISO8601().withMessage('Valid start time required'),
  body('endTime').isISO8601().withMessage('Valid end time required'),
  body('purpose').trim().isLength({ min: 10, max: 500 }).withMessage('Purpose must be between 10-500 characters'),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { telescope, startTime, endTime, purpose, notes } = req.body;

    // Validate times
    const start = moment(startTime);
    const end = moment(endTime);

    if (start.isSameOrAfter(end)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    if (start.isSameOrBefore(moment())) {
      return res.status(400).json({ error: 'Cannot book past time slots' });
    }

    // Check if telescope exists and is active
    const telescopeDoc = await Telescope.findById(telescope);
    if (!telescopeDoc || !telescopeDoc.isActive) {
      return res.status(400).json({ error: 'Telescope not available' });
    }

    // Check for time slot conflicts
    const conflictingBooking = await Booking.findOne({
      telescope,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        {
          startTime: { $lt: end.toDate() },
          endTime: { $gt: start.toDate() }
        }
      ]
    });

    if (conflictingBooking) {
      return res.status(400).json({ error: 'Time slot is already booked' });
    }

    // Create booking
    const booking = new Booking({
      user: req.user._id,
      telescope,
      startTime: start.toDate(),
      endTime: end.toDate(),
      purpose,
      notes
    });

    await booking.save();
    
    // Populate telescope and user data for emails
    await booking.populate([
      { path: 'telescope', select: 'name location' },
      { path: 'user', select: 'name email' }
    ]);

    // Send email notifications
    try {
      await emailService.sendBookingConfirmation(booking);
      await emailService.sendAdminNotification(booking, 'created');
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
      // Continue without failing the booking
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`telescope-${telescope}`).emit('booking-created', {
      booking,
      user: req.user.name
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error: any) {
    if (error.message === 'Time slot is already booked') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking status (admin only)
router.patch('/:id/status', async (req: any, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('telescope', 'name location');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`telescope-${booking.telescope._id}`).emit('booking-updated', booking);

    res.json({
      message: 'Booking status updated',
      booking
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel booking
router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({
      _id: id,
      user: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only allow cancellation if booking is pending or confirmed and at least 2 hours before start time
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel this booking' });
    }

    const now = moment();
    const startTime = moment(booking.startTime);
    
    if (startTime.diff(now, 'hours') < 2) {
      return res.status(400).json({ error: 'Cannot cancel booking less than 2 hours before start time' });
    }

    booking.status = 'cancelled';
    await booking.save();

    // Populate booking data for email
    await booking.populate([
      { path: 'telescope', select: 'name location' },
      { path: 'user', select: 'name email' }
    ]);

    // Send cancellation email
    try {
      await emailService.sendBookingCancellation(booking);
      await emailService.sendAdminNotification(booking, 'cancelled');
    } catch (emailError) {
      // Log error but don't fail the cancellation
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`telescope-${booking.telescope}`).emit('booking-cancelled', booking);

    res.json({
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
