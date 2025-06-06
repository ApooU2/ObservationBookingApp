import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  _id: string;
  user: mongoose.Types.ObjectId;
  telescope: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  purpose: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  reminderSent?: boolean;
  immediateReminderSent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telescope: {
    type: Schema.Types.ObjectId,
    ref: 'Telescope',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  purpose: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  immediateReminderSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
bookingSchema.index({ telescope: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });

// Prevent overlapping bookings
bookingSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('startTime') || this.isModified('endTime')) {
    const overlapping = await mongoose.model('Booking').findOne({
      telescope: this.telescope,
      _id: { $ne: this._id },
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        {
          startTime: { $lt: this.endTime },
          endTime: { $gt: this.startTime }
        }
      ]
    });
    
    if (overlapping) {
      const error = new Error('Time slot is already booked');
      return next(error);
    }
  }
  next();
});

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
