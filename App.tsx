
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, ADMIN_EMAIL, isUserAuthorized } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import EmailForm from './components/EmailForm';
import AdminPanel from './components/AdminPanel';
import EmailLogs from './components/EmailLogs';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'send' | 'admin' | 'logs'>('send');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email;
        const authorized = await isUserAuthorized(email);
        
        if (authorized) {
          setUser({
            uid: firebaseUser.uid,
            email: email,
            displayName: firebaseUser.displayName || 'Usuario',
            photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${email}`,
            isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
            isAuthorized: true
          });
          setLoginError(null);
        } else {
          setUser(null);
          setLoginError('Tu correo no está en la lista blanca de acceso.');
          await auth.signOut();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-api-key') {
        setLoginError('Error de configuración: La API Key de Firebase no es válida.');
      } else {
        setLoginError('Error al iniciar sesión: ' + (error.message || 'Intenta de nuevo.'));
      }
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-ukblue border-t-indigo-400 rounded-full animate-spin mb-6"></div>
          <p className="text-ukblue dark:text-indigo-400 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div 
            className="p-16 text-center relative overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: "linear-gradient(rgba(16, 41, 71, 0.85), rgba(16, 41, 71, 0.9)), url('https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80')" }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <h1 className="text-5xl font-black text-white mb-2 tracking-tighter font-poppins">
              <span className="text-ukorange">Uk</span>Mails
            </h1>
          </div>
          <div className="p-12">
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-10 font-medium">
              Acceso exclusivo para personal de <span className="text-ukblue dark:text-indigo-400 font-black">ukuepa.com</span>.
            </p>
            
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center space-x-4 py-4 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-ukblue dark:hover:border-indigo-500 transition-all font-black text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 group"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google" />
              <span>Entrar con Google</span>
            </button>

            {loginError && (
              <div className="mt-8 p-5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50 flex items-start space-x-4">
                <i className="fas fa-exclamation-circle text-rose-500 text-xl mt-1"></i>
                <div>
                  <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest leading-none mb-1">Error de Acceso</p>
                  <p className="text-xs text-rose-600 dark:text-rose-300 font-medium">{loginError}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      user={user} 
      activeView={activeView} 
      onNavigate={(view) => setActiveView(view as any)}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
    >
      {activeView === 'send' && <EmailForm />}
      {activeView === 'logs' && <EmailLogs user={user} />}
      {activeView === 'admin' && <AdminPanel />}
    </Layout>
  );
};

export default App;
