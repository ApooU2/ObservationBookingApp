import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Visibility as TelescopeIcon,
  TrendingUp as TrendingUpIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardStats {
  statistics: {
    bookings: {
      total: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
      pending: number;
      confirmed: number;
    };
    users: {
      total: number;
      active: number;
    };
    telescopes: {
      total: number;
      active: number;
    };
  };
  recentBookings: any[];
}

interface Analytics {
  bookingTrends: any[];
  statusBreakdown: any[];
  telescopeUsage: any[];
  peakHours: any[];
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    booking: any;
  }>({ open: false, booking: null });
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [analyticsFilter, setAnalyticsFilter] = useState('30d');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, bookingsResponse, analyticsResponse] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/bookings?limit=50'),
        api.get(`/admin/analytics?period=${analyticsFilter}`)
      ]);

      setStats(statsResponse.data);
      setBookings(bookingsResponse.data.bookings);
      setAnalytics(analyticsResponse.data.analytics);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusDialog.booking || !newStatus) return;

    try {
      await api.patch(`/admin/bookings/${statusDialog.booking._id}/status`, {
        status: newStatus,
        notes: adminNotes
      });

      toast.success('Booking status updated successfully');
      loadDashboardData();
      setStatusDialog({ open: false, booking: null });
      setNewStatus('');
      setAdminNotes('');
    } catch (error) {
      toast.error('Failed to update booking status');
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const response = await api.get(`/admin/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bookings.csv';
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bookings.json';
        link.click();
        window.URL.revokeObjectURL(url);
      }

      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      case 'completed': return 'primary';
      default: return 'default';
    }
  };

  // Chart configurations
  const bookingTrendsChart = analytics ? {
    labels: analytics.bookingTrends.map(item => item._id),
    datasets: [
      {
        label: 'Total Bookings',
        data: analytics.bookingTrends.map(item => item.count),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Confirmed',
        data: analytics.bookingTrends.map(item => item.confirmed),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1,
      }
    ],
  } : null;

  const statusBreakdownChart = analytics ? {
    labels: analytics.statusBreakdown.map(item => item._id),
    datasets: [
      {
        data: analytics.statusBreakdown.map(item => item.count),
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
        ],
      }
    ],
  } : null;

  const telescopeUsageChart = analytics ? {
    labels: analytics.telescopeUsage.map(item => item.name),
    datasets: [
      {
        label: 'Bookings',
        data: analytics.telescopeUsage.map(item => item.count),
        backgroundColor: 'rgba(153, 102, 255, 0.8)',
      }
    ],
  } : null;

  if (user?.role !== 'admin') {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          <DashboardIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Admin Dashboard
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadDashboardData}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportData('csv')}
            sx={{ mr: 1 }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportData('json')}
          >
            Export JSON
          </Button>
        </Box>
      </Box>

      <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Bookings" />
        <Tab label="Analytics" />
      </Tabs>

      {selectedTab === 0 && stats && (
        <>
          {/* Statistics Cards */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <ScheduleIcon color="primary" sx={{ mr: 2 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Bookings
                      </Typography>
                      <Typography variant="h4">
                        {stats.statistics.bookings.total}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        +{stats.statistics.bookings.today} today
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <PeopleIcon color="secondary" sx={{ mr: 2 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Total Users
                      </Typography>
                      <Typography variant="h4">
                        {stats.statistics.users.total}
                      </Typography>
                      <Typography variant="body2" color="secondary">
                        {stats.statistics.users.active} active
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <TelescopeIcon color="success" sx={{ mr: 2 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Telescopes
                      </Typography>
                      <Typography variant="h4">
                        {stats.statistics.telescopes.active}
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        of {stats.statistics.telescopes.total} active
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <TrendingUpIcon color="warning" sx={{ mr: 2 }} />
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Pending
                      </Typography>
                      <Typography variant="h4">
                        {stats.statistics.bookings.pending}
                      </Typography>
                      <Typography variant="body2" color="warning.main">
                        Need attention
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Recent Bookings */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Bookings
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Telescope</TableCell>
                      <TableCell>Date & Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.recentBookings.slice(0, 10).map((booking) => (
                      <TableRow key={booking._id}>
                        <TableCell>{booking.user.name}</TableCell>
                        <TableCell>{booking.telescope.name}</TableCell>
                        <TableCell>
                          {dayjs(booking.startTime).format('MMM DD, YYYY HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={booking.status.toUpperCase()}
                            color={getStatusColor(booking.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => {
                              setStatusDialog({ open: true, booking });
                              setNewStatus(booking.status);
                            }}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {selectedTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              All Bookings Management
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Telescope</TableCell>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Purpose</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking._id}>
                      <TableCell>{booking._id.slice(-6)}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{booking.user.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {booking.user.email}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{booking.telescope.name}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {dayjs(booking.startTime).format('MMM DD, YYYY')}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {dayjs(booking.startTime).format('HH:mm')} - {dayjs(booking.endTime).format('HH:mm')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {booking.purpose}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={booking.status.toUpperCase()}
                          color={getStatusColor(booking.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setStatusDialog({ open: true, booking });
                            setNewStatus(booking.status);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 2 && analytics && (
        <>
          <Box mb={3}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={analyticsFilter}
                onChange={(e) => {
                  setAnalyticsFilter(e.target.value);
                  // Reload analytics with new filter
                  setTimeout(() => loadDashboardData(), 100);
                }}
                label="Time Period"
              >
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="3m">Last 3 Months</MenuItem>
                <MenuItem value="1y">Last Year</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Booking Trends
                  </Typography>
                  {bookingTrendsChart && (
                    <Line
                      data={bookingTrendsChart}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { position: 'top' as const },
                          title: { display: false },
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Status Breakdown
                  </Typography>
                  {statusBreakdownChart && (
                    <Doughnut
                      data={statusBreakdownChart}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { position: 'bottom' as const },
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Telescope Usage
                  </Typography>
                  {telescopeUsageChart && (
                    <Bar
                      data={telescopeUsageChart}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          title: { display: false },
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialog.open}
        onClose={() => setStatusDialog({ open: false, booking: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Booking Status</DialogTitle>
        <DialogContent>
          {statusDialog.booking && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Booking: {statusDialog.booking.telescope.name} - {dayjs(statusDialog.booking.startTime).format('MMM DD, YYYY HH:mm')}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                User: {statusDialog.booking.user.name}
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Admin Notes"
                multiline
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this status change..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog({ open: false, booking: null })}>
            Cancel
          </Button>
          <Button onClick={handleStatusUpdate} variant="contained">
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminDashboard;
