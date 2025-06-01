import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Telescope, TimeSlot } from '../types';
import toast from 'react-hot-toast';

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [telescopes, setTelescopes] = useState<Telescope[]>([]);
  const [selectedTelescope, setSelectedTelescope] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs().add(1, 'day'));
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loadingTelescopes, setLoadingTelescopes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchTelescopes = async () => {
      try {
        const response = await api.get('/telescopes');
        setTelescopes(response.data);
        
        // Set initial telescope from URL params
        const telescopeParam = searchParams.get('telescope');
        if (telescopeParam && response.data.find((t: Telescope) => t._id === telescopeParam)) {
          setSelectedTelescope(telescopeParam);
        } else if (response.data.length > 0) {
          setSelectedTelescope(response.data[0]._id);
        }
      } catch (err) {
        setError('Failed to load telescopes');
      } finally {
        setLoadingTelescopes(false);
      }
    };

    fetchTelescopes();
  }, [isAuthenticated, navigate, searchParams]);

  useEffect(() => {
    if (selectedTelescope && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedTelescope, selectedDate]);

  const fetchAvailableSlots = async () => {
    if (!selectedTelescope || !selectedDate) return;

    setLoadingSlots(true);
    try {
      const response = await api.get(
        `/bookings/available/${selectedTelescope}?date=${selectedDate.format('YYYY-MM-DD')}`
      );
      setAvailableSlots(response.data);
      setSelectedSlot(null);
    } catch (err) {
      setError('Failed to load available time slots');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      setError('Please select a time slot');
      return;
    }
    
    if (!purpose.trim() || purpose.trim().length < 10) {
      setError('Please provide a purpose of at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/bookings', {
        telescope: selectedTelescope,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        purpose: purpose.trim(),
        notes: notes.trim(),
      });

      toast.success('Booking created successfully!');
      navigate('/bookings');
    } catch (err: any) {
      console.error('Booking error:', err.response?.data);
      
      // Handle validation errors
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errorMessage = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(errorMessage);
      } else {
        setError(err.response?.data?.error || 'Failed to create booking');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTelescopes) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Book Observatory Time
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Select Telescope"
                value={selectedTelescope}
                onChange={(e) => setSelectedTelescope(e.target.value)}
                required
              >
                {telescopes.map((telescope) => (
                  <MenuItem key={telescope._id} value={telescope._id}>
                    {telescope.name} - {telescope.location}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Select Date"
                  value={selectedDate}
                  onChange={(newValue) => setSelectedDate(newValue)}
                  minDate={dayjs().add(1, 'day')}
                  maxDate={dayjs().add(30, 'day')}
                  sx={{ width: '100%' }}
                />
              </LocalizationProvider>
            </Grid>

            {selectedDate && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Available Time Slots for {selectedDate.format('MMMM DD, YYYY')}
                </Typography>
                
                {loadingSlots ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress />
                  </Box>
                ) : availableSlots.length > 0 ? (
                  <Grid container spacing={2}>
                    {availableSlots.map((slot, index) => (
                      <Grid item xs={6} sm={4} md={3} key={index}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: selectedSlot === slot ? 2 : 1,
                            borderColor: selectedSlot === slot ? 'primary.main' : 'divider',
                            '&:hover': {
                              borderColor: 'primary.main',
                            },
                          }}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="body2">
                              {slot.display}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info">
                    No available time slots for this date. Please select another date.
                  </Alert>
                )}
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Purpose of Observation"
                multiline
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Please describe what you plan to observe (e.g., planetary observation, deep sky objects, photography, etc.)"
                required
                inputProps={{ maxLength: 500 }}
                helperText={`${purpose.length}/500 characters (minimum 10 characters required)`}
                error={purpose.length > 0 && purpose.length < 10}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Additional Notes (Optional)"
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional requirements or notes for your observation session"
                inputProps={{ maxLength: 1000 }}
                helperText={`${notes.length}/1000 characters`}
              />
            </Grid>

            {selectedSlot && (
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Booking Summary
                    </Typography>
                    <Typography variant="body2">
                      <strong>Telescope:</strong> {telescopes.find(t => t._id === selectedTelescope)?.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Date:</strong> {selectedDate?.format('MMMM DD, YYYY')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Time:</strong> {selectedSlot.display}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}

            <Grid item xs={12}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={!selectedSlot || !purpose.trim() || purpose.trim().length < 10 || submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? <CircularProgress size={24} /> : 'Book Observatory Time'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default BookingPage;
