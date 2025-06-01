import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Visibility as TelescopeIcon, LocationOn, Schedule } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Telescope } from '../types';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [telescopes, setTelescopes] = useState<Telescope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTelescopes = async () => {
      try {
        const response = await api.get('/telescopes');
        setTelescopes(response.data);
      } catch (err: any) {
        setError('Failed to load telescopes');
      } finally {
        setLoading(false);
      }
    };

    fetchTelescopes();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Observatory Telescope Booking
        </Typography>
        <Typography variant="h6" color="textSecondary" paragraph>
          Book your stargazing session with our professional telescopes
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {telescopes.map((telescope) => (
          <Grid item xs={12} md={6} lg={4} key={telescope._id}>
            <Card 
              elevation={3} 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                  <TelescopeIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    {telescope.name}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="textSecondary" paragraph>
                  {telescope.description}
                </Typography>

                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Specifications:
                  </Typography>
                  <Chip
                    label={`Aperture: ${telescope.specifications.aperture}`}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={`Focal Length: ${telescope.specifications.focalLength}`}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={telescope.specifications.mountType}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>

                <Box display="flex" alignItems="center" mb={1}>
                  <LocationOn color="action" sx={{ mr: 1, fontSize: 16 }} />
                  <Typography variant="body2">
                    {telescope.location}
                  </Typography>
                </Box>

                {telescope.maintenanceSchedule && (
                  <Box display="flex" alignItems="center">
                    <Schedule color="action" sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2" color="textSecondary">
                      Next maintenance: {new Date(telescope.maintenanceSchedule).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              
              <CardActions>
                <Button
                  size="large"
                  variant="contained"
                  fullWidth
                  onClick={() => navigate(`/book?telescope=${telescope._id}`)}
                >
                  Book This Telescope
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {telescopes.length === 0 && !loading && (
        <Box textAlign="center" mt={4}>
          <Typography variant="h6" color="textSecondary">
            No telescopes available at the moment
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default HomePage;
