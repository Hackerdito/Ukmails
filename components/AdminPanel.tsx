
import React, { useState, useEffect } from 'react';
import { db, addAuthorizedUser, removeAuthorizedUser, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'whitelisted_users'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setError('Email no válido');
      return;
    }
    
    setIsLoading(true);
    setError('');
    try {
      await addAuthorizedUser(newEmail.trim().toLowerCase(), auth.currentUser?.email || 'admin');
      setNewEmail('');
    } catch (err: any) {
      setError('Error al añadir: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`¿Quitar acceso a ${email}?`)) return;
    try {
      await removeAuthorizedUser(email);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Control de Acceso</h2>
          <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">Gestión de usuarios autorizados</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-10">
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="colaborador@ukuepa.com"
              className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-ukblue dark:focus:ring-indigo-500 outline-none transition-all text-sm font-bold dark:text-white"
              disabled={isLoading}
            />
            <i className="fas fa-user-plus absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"></i>
          </div>
          <button
            type="submit"
            disabled={isLoading || !newEmail}
            className="px-10 py-4 bg-ukblue dark:bg-indigo-600 hover:scale-105 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 flex items-center justify-center min-w-[180px] shadow-xl shadow-ukblue/20 dark:shadow-none"
          >
            {isLoading ? <i className="fas fa-circle-notch fa-spin mr-3"></i> : <i className="fas fa-shield-alt mr-3"></i>}
            Autorizar
          </button>
        </form>
        {error && <p className="mt-4 text-[10px] text-rose-500 font-black uppercase tracking-widest">{error}</p>}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Colaborador</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Autorizado Por</th>
                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fecha Alta</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center text-slate-300 dark:text-slate-600 text-sm font-black uppercase tracking-widest">No hay usuarios adicionales</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-10 py-6 whitespace-nowrap">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{user.email}</span>
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg uppercase">
                        {user.addedBy || 'ADMIN'}
                      </span>
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        {user.addedAt ? new Date(user.addedAt).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteUser(user.email)}
                        className="text-slate-200 group-hover:text-rose-500 transition-all p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
