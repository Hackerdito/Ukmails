
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
  onNavigate: (view: 'send' | 'admin' | 'logs') => void;
  activeView: 'send' | 'admin' | 'logs';
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onNavigate, activeView, toggleTheme, isDarkMode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigateTo = (view: 'send' | 'admin' | 'logs') => {
    onNavigate(view);
    setIsMenuOpen(false);
  };

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-ukblue sticky top-0 z-[100] shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo y Marca */}
            <div className="flex items-center space-x-4">
              <img src="https://fileuk.netlify.app/universidaduk.png" alt="UK Logo" className="h-8 md:h-10 transition-transform hover:scale-105" />
              <div className="h-8 w-[1px] bg-white/20 hidden sm:block"></div>
              <h1 className="text-lg font-black text-white tracking-tighter hidden xs:block">
                Mails<span className="text-indigo-400">.</span>
              </h1>
            </div>

            {/* Navegación Desktop */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => navigateTo('send')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeView === 'send' 
                  ? 'bg-white text-ukblue shadow-lg' 
                  : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className="fas fa-paper-plane mr-2"></i>
                Enviar
              </button>
              <button
                onClick={() => navigateTo('logs')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  activeView === 'logs' 
                  ? 'bg-white text-ukblue shadow-lg' 
                  : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className="fas fa-chart-pie mr-2"></i>
                Historial
              </button>
              {user.isAdmin && (
                <button
                  onClick={() => navigateTo('admin')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeView === 'admin' 
                    ? 'bg-white text-ukblue shadow-lg' 
                    : 'text-indigo-100 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <i className="fas fa-user-shield mr-2"></i>
                  Admin
                </button>
              )}
            </nav>

            {/* Acciones de Usuario y Tema */}
            <div className="flex items-center space-x-2 md:space-x-4">
              <button
                onClick={toggleTheme}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                title="Cambiar Tema"
              >
                <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
              
              <div className="h-8 w-[1px] bg-white/20"></div>

              {/* Perfil y Logout Desktop */}
              <div className="hidden md:flex items-center space-x-3 pl-2">
                <div className="text-right">
                  <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{user.displayName}</p>
                  <p className="text-[9px] font-medium text-indigo-200 mt-1">{user.isAdmin ? 'Administrador' : 'Editor'}</p>
                </div>
                <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-xl border-2 border-white/20" />
                <button
                  onClick={handleSignOut}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-500/20 text-rose-100 hover:bg-rose-500 hover:text-white transition-all ml-2"
                  title="Cerrar Sesión"
                >
                  <i className="fas fa-power-off"></i>
                </button>
              </div>

              {/* Botón Menú Móvil */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white"
              >
                <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Menú Móvil Desplegable */}
        {isMenuOpen && (
          <div className="md:hidden bg-ukblue border-t border-white/10 animate-in slide-in-from-top duration-200 pb-6">
            <div className="px-4 py-4 mb-4 border-b border-white/10 flex items-center space-x-4">
              <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-xl border-2 border-white/20" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-widest">{user.displayName}</p>
                <p className="text-[10px] text-indigo-300 font-bold">{user.email}</p>
              </div>
            </div>
            <div className="px-4 space-y-2">
              <button
                onClick={() => navigateTo('send')}
                className={`w-full flex items-center px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                  activeView === 'send' ? 'bg-white text-ukblue' : 'text-white hover:bg-white/10'
                }`}
              >
                <i className="fas fa-paper-plane mr-4 w-5"></i> Enviar Mails
              </button>
              <button
                onClick={() => navigateTo('logs')}
                className={`w-full flex items-center px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                  activeView === 'logs' ? 'bg-white text-ukblue' : 'text-white hover:bg-white/10'
                }`}
              >
                <i className="fas fa-chart-pie mr-4 w-5"></i> Historial / Dashboard
              </button>
              {user.isAdmin && (
                <button
                  onClick={() => navigateTo('admin')}
                  className={`w-full flex items-center px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${
                    activeView === 'admin' ? 'bg-white text-ukblue' : 'text-white hover:bg-white/10'
                  }`}
                >
                  <i className="fas fa-user-shield mr-4 w-5"></i> Panel de Usuarios
                </button>
              )}
              <div className="pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <i className="fas fa-sign-out-alt mr-4 w-5"></i> Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
            <img src="https://fileuk.netlify.app/universidaduk.png" alt="Uk Logo Small" className="h-6 opacity-30 grayscale dark:invert" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">©Universidad Uk 2026</p>
          </div>
          <div className="flex items-center space-x-4">
             <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-lg uppercase">Status: Online</span>
             <span className="text-[9px] font-black text-slate-400 px-2 uppercase">v3.0.0 Stable</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
