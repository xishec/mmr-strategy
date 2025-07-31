import React from 'react';
import logo from './logo.svg';
import './App.css';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Button, 
  Box 
} from '@mui/material';
import { Home } from '@mui/icons-material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Home sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            MMR SIG9 App
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box textAlign="center">
          <img src={logo} className="App-logo" alt="logo" style={{ height: '200px' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to React with Material-UI
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Edit <code>src/App.tsx</code> and save to reload.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mr: 2 }}
          >
            Learn React
          </Button>
          <Button 
            variant="outlined" 
            color="secondary"
            href="https://mui.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn MUI
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
