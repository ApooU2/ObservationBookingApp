import mongoose, { Document, Schema } from 'mongoose';

export interface ITelescope extends Document {
  _id: string;
  name: string;
  description: string;
  specifications: {
    aperture: string;
    focalLength: string;
    mountType: string;
    accessories: string[];
  };
  location: string;
  isActive: boolean;
  maintenanceSchedule?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const telescopeSchema = new Schema<ITelescope>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  specifications: {
    aperture: String,
    focalLength: String,
    mountType: String,
    accessories: [String]
  },
  location: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maintenanceSchedule: Date
}, {
  timestamps: true
});

export const Telescope = mongoose.model<ITelescope>('Telescope', telescopeSchema);
