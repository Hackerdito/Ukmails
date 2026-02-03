
import React, { useState, useEffect, useMemo } from 'react';
import { db, deleteEmailLog } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { UserProfile } from '../types';

interface EmailLogsProps {
  user: UserProfile | null;
}

const EmailLogs: React.FC<EmailLogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'email_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setError(null);
      const logList = snapshot.docs.map(doc => {
        const data = doc.data();
        let date = new Date();
        
        if (data.timestamp) {
          date = new Date(data.timestamp);
        } else if (data.createdAt) {
          date = new Date(data.createdAt);
        }

        return {
          id: doc.id,
          ...data,
          formattedDate: date
        };
      });
      setLogs(logList);
      setLoading(false);
    }, (err) => {
      console.error("Fallo Firestore Snapshot:", err);
      setError("Error de permisos o conexión con Firebase. Verifica las reglas de Firestore.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (logId: string) => {
    if (!window.confirm('¿Eliminar definitivamente este registro del historial?')) return;
    
    setDeletingId(logId);
    try {
      await deleteEmailLog(logId);
    } catch (err: any) {
      console.error("Delete permission error:", err);
      alert('Error de Permisos: No tienes autorización para borrar en la base de datos. Asegúrate de actualizar las reglas en la consola de Firebase.');
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(() => {
    return logs.reduce((acc, log) => {
      const count = Number(log.count) || 0;
      acc.total += count;
      if (log.status === 'success') acc.success += count;
      if (log.status === 'error') acc.error += count;
      if (log.status === 'cancelled') acc.cancelled += count;
      return acc;
    }, { total: 0, success: 0, error: 0, cancelled: 0 });
  }, [logs]);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">Historial de Mails</h2>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">Sincronización directa con Firebase Data</p>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-3xl border border-rose-100 dark:border-rose-900/50 font-black text-xs uppercase text-center shadow-sm">
          <i className="fas fa-exclamation-triangle mr-2"></i> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Mails</p>
           <h3 className="text-4xl font-black text-ukblue dark:text-white">{stats.total}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Exitosos</p>
           <h3 className="text-4xl font-black text-emerald-600">{stats.success}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Errores</p>
           <h3 className="text-4xl font-black text-rose-600">{stats.error}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cancelados</p>
           <h3 className="text-4xl font-black text-amber-600">{stats.cancelled}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Plantilla</th>
                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cant.</th>
                <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                {user?.isAdmin && <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={user?.isAdmin ? 5 : 4} className="py-16 text-center font-bold text-slate-400">Consultando base de datos...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={user?.isAdmin ? 5 : 4} className="py-16 text-center font-bold text-slate-400 italic">No hay logs en Firebase Data</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 group">
                    <td className="px-8 py-6">
                      <div className="text-xs font-black text-slate-700 dark:text-slate-200">{log.formattedDate.toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{log.formattedDate.toLocaleTimeString()}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-ukblue dark:text-indigo-400">{log.templateName}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">{log.fromEmail}</div>
                    </td>
                    <td className="px-8 py-6 text-xs font-black text-slate-600 dark:text-slate-300">
                      {log.count}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'cancelled' ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    {user?.isAdmin && (
                      <td className="px-8 py-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                            deletingId === log.id 
                            ? 'bg-slate-100 text-slate-300' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/20 opacity-0 group-hover:opacity-100'
                          }`}
                          title="Eliminar Registro"
                        >
                          {deletingId === log.id ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-trash-alt text-xs"></i>}
                        </button>
                      </td>
                    )}
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

export default EmailLogs;
