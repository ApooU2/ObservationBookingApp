import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import { Visibility, AccountCircle, Logout, AdminPanelSettings } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
    navigate('/');
  };

  const handleProfile = () => {
    navigate('/profile');
    handleClose();
  };

  const handleAdminPanel = () => {
    navigate('/admin');
    handleClose();
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: '#1a237e' }}>
      <Toolbar>
        <Visibility sx={{ mr: 2 }} />
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Observatory Booking
        </Typography>

        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button color="inherit" onClick={() => navigate('/bookings')}>
              My Bookings
            </Button>
            <Button color="inherit" onClick={() => navigate('/book')}>
              Book Time
            </Button>
            {user?.role === 'admin' && (
              <Button 
                color="inherit" 
                onClick={() => navigate('/admin')}
                sx={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  }
                }}
                startIcon={<AdminPanelSettings />}
              >
                Admin Panel
              </Button>
            )}
            
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.name.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleProfile}>
                <AccountCircle sx={{ mr: 1 }} />
                Profile
              </MenuItem>
              {user?.role === 'admin' && (
                <MenuItem onClick={handleAdminPanel}>
                  <AdminPanelSettings sx={{ mr: 1 }} />
                  Admin Panel
                </MenuItem>
              )}
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box>
            <Button color="inherit" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button color="inherit" onClick={() => navigate('/register')}>
              Register
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
