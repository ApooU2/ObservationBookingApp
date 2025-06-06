export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Telescope {
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
  maintenanceSchedule?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  _id: string;
  user: string | User;
  telescope: string | Telescope;
  startTime: string;
  endTime: string;
  purpose: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  display: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: string[];
}
