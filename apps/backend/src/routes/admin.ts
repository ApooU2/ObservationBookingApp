import express from 'express';
import { body, validationResult } from 'express-validator';
import moment from 'moment';
import { Booking } from '../models/Booking';
import { Telescope } from '../models/Telescope';
import { User } from '../models/User';

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get dashboard statistics
router.get('/stats', requireAdmin, async (req: any, res) => {
  try {
    const today = moment().startOf('day');
    const thisWeek = moment().startOf('week');
    const thisMonth = moment().startOf('month');

    const [
      totalBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      totalUsers,
      activeUsers,
      totalTelescopes,
      activeTelescopes,
      pendingBookings,
      confirmedBookings,
      recentBookings
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ 
        createdAt: { $gte: today.toDate() } 
      }),
      Booking.countDocuments({ 
        createdAt: { $gte: thisWeek.toDate() } 
      }),
      Booking.countDocuments({ 
        createdAt: { $gte: thisMonth.toDate() } 
      }),
      User.countDocuments(),
      User.countDocuments({ 
        lastLoginAt: { $gte: moment().subtract(30, 'days').toDate() } 
      }),
      Telescope.countDocuments(),
      Telescope.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.find()
        .populate('user', 'name email')
        .populate('telescope', 'name location')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      statistics: {
        bookings: {
          total: totalBookings,
          today: todayBookings,
          thisWeek: weekBookings,
          thisMonth: monthBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings
        },
        users: {
          total: totalUsers,
          active: activeUsers
        },
        telescopes: {
          total: totalTelescopes,
          active: activeTelescopes
        }
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all bookings with filters
router.get('/bookings', requireAdmin, async (req: any, res) => {
  try {
    const { 
      status, 
      telescope, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter: any = {};
    
    if (status) filter.status = status;
    if (telescope) filter.telescope = telescope;
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('user', 'name email')
        .populate('telescope', 'name location')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(filter)
    ]);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: skip + bookings.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking status
router.patch('/bookings/:id/status', requireAdmin, [
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed'])
    .withMessage('Invalid status'),
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { 
        status, 
        ...(notes && { adminNotes: notes })
      },
      { new: true }
    ).populate([
      { path: 'user', select: 'name email' },
      { path: 'telescope', select: 'name location' }
    ]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`telescope-${booking.telescope._id}`).emit('booking-updated', booking);
    io.to(`user-${booking.user._id}`).emit('booking-status-changed', booking);

    res.json({
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booking analytics
router.get('/analytics', requireAdmin, async (req: any, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate: moment.Moment;
    let groupBy: string;
    
    switch (period) {
      case '7d':
        startDate = moment().subtract(7, 'days');
        groupBy = '%Y-%m-%d';
        break;
      case '30d':
        startDate = moment().subtract(30, 'days');
        groupBy = '%Y-%m-%d';
        break;
      case '3m':
        startDate = moment().subtract(3, 'months');
        groupBy = '%Y-%m';
        break;
      case '1y':
        startDate = moment().subtract(1, 'year');
        groupBy = '%Y-%m';
        break;
      default:
        startDate = moment().subtract(30, 'days');
        groupBy = '%Y-%m-%d';
    }

    const [
      bookingTrends,
      statusBreakdown,
      telescopeUsage,
      peakHours
    ] = await Promise.all([
      // Booking trends over time
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate.toDate() }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: groupBy, date: '$createdAt' } },
            count: { $sum: 1 },
            confirmed: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Status breakdown
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate.toDate() }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Telescope usage
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate.toDate() },
            status: { $in: ['confirmed', 'completed'] }
          }
        },
        {
          $lookup: {
            from: 'telescopes',
            localField: 'telescope',
            foreignField: '_id',
            as: 'telescopeInfo'
          }
        },
        {
          $unwind: '$telescopeInfo'
        },
        {
          $group: {
            _id: '$telescope',
            name: { $first: '$telescopeInfo.name' },
            count: { $sum: 1 },
            totalHours: {
              $sum: {
                $divide: [
                  { $subtract: ['$endTime', '$startTime'] },
                  1000 * 60 * 60
                ]
              }
            }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Peak usage hours
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate.toDate() },
            status: { $in: ['confirmed', 'completed'] }
          }
        },
        {
          $group: {
            _id: { $hour: '$startTime' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      period,
      analytics: {
        bookingTrends,
        statusBreakdown,
        telescopeUsage,
        peakHours
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export booking data
router.get('/export', requireAdmin, async (req: any, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    const filter: any = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };

    const bookings = await Booking.find(filter)
      .populate('user', 'name email')
      .populate('telescope', 'name location')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csv = [
        'ID,User Name,User Email,Telescope,Location,Start Time,End Time,Purpose,Status,Created At',
        ...bookings.map(booking => [
          booking._id,
          (booking.user as any).name,
          (booking.user as any).email,
          (booking.telescope as any).name,
          (booking.telescope as any).location,
          booking.startTime.toISOString(),
          booking.endTime.toISOString(),
          booking.purpose.replace(/,/g, ';'),
          booking.status,
          booking.createdAt.toISOString()
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bookings.csv');
      res.send(csv);
    } else {
      res.json({ bookings });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
