
import React, { useState, useEffect } from 'react';
import { Presentation as PresentationIcon, Activity, LogOut, Maximize2, Minimize2 } from 'lucide-react';
import Presentation from './components/Presentation';
import Tracker from './components/tracker/Tracker';
import Login from './components/Login';
import { User } from './types';

// Simplified view modes
type ViewMode = 'presentation' | 'tracker';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<ViewMode>('presentation');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check if user is already logged in (simple session persistence)
  useEffect(() => {
    const savedUser = localStorage.getItem('sprint_current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('sprint_current_user', JSON.stringify(newUser));
    setMode('tracker');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sprint_current_user');
    setMode('presentation');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-race-dark overflow-hidden font-sans">
      
      {/* Top Navigation Bar - Racing Style */}
      <header className="bg-race-navy text-white p-3 md:p-4 shadow-[0_5px_20px_rgba(0,0,0,0.5)] z-40 flex justify-between items-center shrink-0 border-b border-white/10 relative">
        {/* Background Texture */}
        <div className="absolute inset-0 bg-carbon-pattern opacity-50 pointer-events-none"></div>

        <div className="flex flex-col relative z-10">
          <h1 className="text-xl md:text-2xl font-display font-black uppercase tracking-tighter text-white flex items-center gap-2 italic">
            Sprint Final <span className="text-race-yellow drop-shadow-[0_0_5px_rgba(250,255,0,0.8)]">All-In</span>
          </h1>
          {user && (
             <span className="text-[10px] md:text-xs text-gray-400 font-bold flex items-center gap-1 animate-fade-in uppercase tracking-wider">
               Piloto: <span className="text-white">{user.name}</span> {user.role === 'admin' && <span className="text-race-yellow text-[9px] border border-race-yellow px-1 rounded ml-1">TEAM PRINCIPAL</span>}
             </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 relative z-10">
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-race-yellow transition-colors hidden md:block"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <div className="flex bg-black/40 rounded-sm p-1 border border-white/5">
            <button
              onClick={() => setMode('presentation')}
              className={`p-2 px-3 md:px-4 flex items-center gap-2 transition-all skew-x-[-10deg] ${
                mode === 'presentation' 
                  ? 'bg-race-yellow text-race-dark font-black shadow-[0_0_10px_rgba(250,255,0,0.3)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Apresentação"
            >
              <PresentationIcon size={18} className="skew-x-[10deg]" />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-wider skew-x-[10deg]">Treinamento</span>
            </button>
            <button
              onClick={() => setMode('tracker')}
              className={`p-2 px-3 md:px-4 flex items-center gap-2 transition-all skew-x-[-10deg] ${
                mode === 'tracker' 
                  ? 'bg-race-yellow text-race-dark font-black shadow-[0_0_10px_rgba(250,255,0,0.3)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title="Acompanhamento"
            >
              <Activity size={18} className="skew-x-[10deg]" />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-wider skew-x-[10deg]">Painel</span>
            </button>
          </div>

          {user && (
            <button 
              onClick={handleLogout}
              className="p-2 md:p-3 bg-red-500/10 hover:bg-red-500/20 text-race-red border border-race-red/20 hover:border-race-red transition-all skew-x-[-10deg]"
              title="Sair"
            >
              <LogOut size={18} className="skew-x-[10deg]" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {mode === 'presentation' ? (
          <Presentation switchToTracker={() => setMode('tracker')} />
        ) : (
          <div className="h-screen w-screen overflow-hidden bg-race-dark">
            {user ? (
               <Tracker currentUser={user} />
            ) : (
               <Login onLogin={handleLogin} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
