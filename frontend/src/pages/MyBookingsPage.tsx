import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { 
  AccessTime, 
  Visibility as TelescopeIcon, 
  Cancel,
  CheckCircle,
  Pending,
  EventNote
} from '@mui/icons-material';
import dayjs from 'dayjs';
import api from '../utils/api';
import { Booking, Telescope } from '../types';
import toast from 'react-hot-toast';

const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    booking: Booking | null;
  }>({ open: false, booking: null });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      setBookings(response.data);
    } catch (err: any) {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    try {
      await api.delete(`/bookings/${booking._id}`);
      toast.success('Booking cancelled successfully');
      fetchBookings(); // Refresh the list
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel booking');
    }
    setCancelDialog({ open: false, booking: null });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle color="success" />;
      case 'pending':
        return <Pending color="warning" />;
      case 'cancelled':
        return <Cancel color="error" />;
      case 'completed':
        return <EventNote color="primary" />;
      default:
        return <Pending />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      case 'completed':
        return 'primary';
      default:
        return 'default';
    }
  };

  const canCancelBooking = (booking: Booking) => {
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return false;
    }
    
    const startTime = dayjs(booking.startTime);
    const now = dayjs();
    return startTime.diff(now, 'hours') >= 2;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Bookings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {bookings.length === 0 ? (
        <Box textAlign="center" mt={6}>
          <TelescopeIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No bookings found
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Start exploring the universe by booking your first observation session!
          </Typography>
          <Button variant="contained" href="/book">
            Book Observatory Time
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {bookings.map((booking) => {
            const telescope = booking.telescope as Telescope;
            const startTime = dayjs(booking.startTime);
            const endTime = dayjs(booking.endTime);
            
            return (
              <Grid item xs={12} md={6} lg={4} key={booking._id}>
                <Card 
                  elevation={3}
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        <TelescopeIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" component="h2">
                          {telescope.name}
                        </Typography>
                      </Box>
                      <Chip
                        icon={getStatusIcon(booking.status)}
                        label={booking.status.toUpperCase()}
                        color={getStatusColor(booking.status) as any}
                        size="small"
                      />
                    </Box>

                    <Box display="flex" alignItems="center" mb={1}>
                      <AccessTime color="action" sx={{ mr: 1, fontSize: 16 }} />
                      <Typography variant="body2">
                        {startTime.format('MMM DD, YYYY • HH:mm')} - {endTime.format('HH:mm')}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="textSecondary" paragraph>
                      <strong>Purpose:</strong> {booking.purpose}
                    </Typography>

                    {booking.notes && (
                      <Typography variant="body2" color="textSecondary">
                        <strong>Notes:</strong> {booking.notes}
                      </Typography>
                    )}

                    <Typography variant="caption" color="textSecondary" display="block" mt={2}>
                      Booked on {dayjs(booking.createdAt).format('MMM DD, YYYY')}
                    </Typography>
                  </CardContent>

                  <CardActions>
                    {canCancelBooking(booking) && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setCancelDialog({ open: true, booking })}
                      >
                        Cancel Booking
                      </Button>
                    )}
                    {booking.status === 'completed' && (
                      <Button size="small" color="primary">
                        Rate Session
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={cancelDialog.open}
        onClose={() => setCancelDialog({ open: false, booking: null })}
      >
        <DialogTitle>Cancel Booking</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel this booking? This action cannot be undone.
          </Typography>
          {cancelDialog.booking && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                <strong>Telescope:</strong> {(cancelDialog.booking.telescope as Telescope).name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Time:</strong> {dayjs(cancelDialog.booking.startTime).format('MMM DD, YYYY • HH:mm')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog({ open: false, booking: null })}>
            Keep Booking
          </Button>
          <Button 
            onClick={() => cancelDialog.booking && handleCancelBooking(cancelDialog.booking)}
            color="error"
            variant="contained"
          >
            Cancel Booking
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyBookingsPage;
