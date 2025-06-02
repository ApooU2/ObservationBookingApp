import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Container, Button, Box } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if it's from a browser extension
    const isExtensionError = error.stack && (
      error.stack.includes('chrome-extension://') ||
      error.stack.includes('moz-extension://') ||
      error.stack.includes('inpage.js') ||
      error.message.includes('extension')
    );
    
    if (isExtensionError) {
      console.warn('Browser extension error ignored in ErrorBoundary:', error.message);
      // Reset the error state to prevent showing error UI
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 0);
      return;
    }
    
    // Log error details for actual app errors
    console.error('App error caught by boundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      // Check if it's a browser extension error
      const isExtensionError = this.state.error?.stack && (
        this.state.error.stack.includes('chrome-extension://') ||
        this.state.error.stack.includes('moz-extension://') ||
        this.state.error.stack.includes('inpage.js') ||
        this.state.error.message?.includes('extension')
      );
      
      if (isExtensionError) {
        // Don't show error boundary for extension errors, just render children
        return this.props.children;
      }
        return this.props.children;
      }

      return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Something went wrong!</strong>
          </Alert>
          
          <Box sx={{ mb: 2 }}>
            <p>The application encountered an unexpected error. This might be caused by:</p>
            <ul>
              <li>A temporary network issue</li>
              <li>Browser extension interference</li>
              <li>Cached data conflicts</li>
            </ul>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
              variant="contained" 
              onClick={this.handleReload}
              color="primary"
            >
              Reload Page
            </Button>
            <Button 
              variant="outlined" 
              onClick={this.handleReset}
              color="secondary"
            >
              Try Again
            </Button>
          </Box>

          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '1rem' }}>
              <summary>Error Details (Development Only)</summary>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '1rem', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.8rem'
              }}>
                {this.state.error?.toString()}
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
