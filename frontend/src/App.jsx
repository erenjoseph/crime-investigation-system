import { useState, useEffect } from 'react';
import { initDB, seedDatabase } from './db/database';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FIRModule from './components/FIRModule';
import Criminals from './components/Criminals';
import Evidence from './components/Evidence';
import AIAnalysis from './components/AIAnalysis';
import Login from './components/Login';
import './App.css';

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState(null);
  
  // Auth and Theme States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('ciras_theme') || 'dark');

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ciras_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveModule('dashboard');
  };

  useEffect(() => {
    async function bootstrap() {
      try {
        await initDB();
        await seedDatabase();
        setDbReady(true);
      } catch (err) {
        console.error('DB init error:', err);
        setError(err.message);
      }
    }
    bootstrap();
  }, []);

  if (error) {
    return (
      <div className="app-error">
        <h2>⚠️ Database Error</h2>
        <p>{error}</p>
        <p>Please try refreshing the page.</p>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="app-loading">
        <div className="loading-logo">CIRAS</div>
        <h2>SYSTEM BOOT</h2>
        <div className="loading-bar"><div className="loading-fill" /></div>
        <p className="loading-sub">Connecting to Secure Database...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} theme={theme} toggleTheme={toggleTheme} />;
  }

  function renderModule() {
    switch (activeModule) {
      case 'dashboard': return <Dashboard />;
      case 'fir': return <FIRModule />;
      case 'criminals': return <Criminals />;
      case 'evidence': return <Evidence />;
      case 'ai': return <AIAnalysis />;
      default: return <Dashboard />;
    }
  }

  return (
    <div className="app">
      <Sidebar 
        activeModule={activeModule} 
        onNavigate={setActiveModule} 
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderModule()}
      </main>
    </div>
  );
}

export default App;
