
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { EmailFormData } from '../types';
import { sendEmailViaSendGrid } from '../services/sendgridService';
import { saveEmailLog } from '../firebase';
import Papa from 'papaparse';

interface SendGridTemplate {
  id: string;
  name: string;
}

const EmailForm: React.FC = () => {
  const [formData, setFormData] = useState<EmailFormData>({
    fromEmail: 'info@ukuepa.com',
    fromName: 'Universidad Uk',
    toEmail: '',
    templateId: '',
    dynamicTemplateData: ''
  });

  const [templates, setTemplates] = useState<SendGridTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [csvRecipients, setCsvRecipients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(false);
  
  // Estados de progreso
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    errors: 0,
    percentage: 0
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevenir cierre de pestaña accidentalmente
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSending) {
        e.preventDefault();
        e.returnValue = 'Hay un envío de correos en curso. Si cierras la pestaña se detendrá.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSending]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/get-templates');
        if (!response.ok) throw new Error("Error API");
        const data = await response.json();
        if (Array.isArray(data)) {
          setTemplates(data);
          if (data.length > 0) {
            setFormData(prev => ({ ...prev, templateId: data[0].id }));
          }
        }
      } catch (err) {
        console.error("Error al cargar templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  const selectedTemplate = useMemo(() => 
    templates.find(t => t.id === formData.templateId) || { name: 'Selecciona una plantilla', id: formData.templateId }
  , [formData.templateId, templates]);

  const validateEmail = (email: string) => email && email.toLowerCase().endsWith('@ukuepa.com');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const headers = Object.keys(results.data[0]);
          const emailCol = headers.find(h => h.toLowerCase().includes('email') || h.toLowerCase().includes('correo')) || headers[0];
          const emails = results.data.map((row: any) => row[emailCol]).filter(email => email && email.includes('@'));
          setCsvRecipients(emails);
          setProgress(prev => ({ ...prev, total: emails.length, current: 0, percentage: 0 }));
        }
      },
    });
  };

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = csvRecipients.length > 0 ? csvRecipients : [formData.toEmail].filter(em => em.trim() !== '');
    const total = targets.length;

    if (total === 0) {
      setStatus({ type: 'error', message: 'Indica destinatarios' });
      return;
    }

    setIsSending(true);
    setCancelRequest(false);
    setStatus({ type: '', message: '' });
    
    let successLocal = 0;
    let errorsLocal = 0;

    // Reiniciar progreso
    setProgress({ current: 0, total, success: 0, errors: 0, percentage: 0 });

    for (let i = 0; i < total; i++) {
      if (cancelRequest) break;

      const email = targets[i].trim();
      
      try {
        await sendEmailViaSendGrid({ ...formData, toEmail: email });
        successLocal++;
      } catch (mailErr: any) {
        errorsLocal++;
        console.error(`Fallo envío a ${email}:`, mailErr.message);
      }

      // Actualizar progreso UI
      const current = i + 1;
      setProgress({
        total,
        current,
        success: successLocal,
        errors: errorsLocal,
        percentage: Math.round((current / total) * 100)
      });
    }

    // Finalizar y Guardar Log
    const finalStatus = cancelRequest ? 'cancelled' : (errorsLocal === total ? 'error' : 'success');
    
    await saveEmailLog({
      templateName: selectedTemplate.name,
      templateId: formData.templateId,
      count: successLocal,
      status: finalStatus,
      fromEmail: formData.fromEmail,
      error: errorsLocal > 0 ? `${errorsLocal} fallidos de ${total}` : undefined
    });

    setStatus({ 
      type: finalStatus === 'error' ? 'error' : 'success', 
      message: cancelRequest ? 'Envío cancelado por el usuario.' : `Proceso terminado. ${successLocal} exitosos, ${errorsLocal} errores.` 
    });
    
    setIsSending(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-6xl mx-auto">
      <div className="lg:col-span-6 space-y-6">
        <form onSubmit={handleSendEmails} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-ukblue px-10 py-8 text-white relative">
            <h2 className="text-xl font-black flex items-center tracking-tighter">
              <i className="fas fa-magic mr-3 text-indigo-400"></i>
              Configurar Envío
            </h2>
            {isSending && (
               <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Enviando...</span>
               </div>
            )}
          </div>

          <div className="p-10 space-y-6">
            {/* PROGRESO - Solo se muestra al enviar */}
            {isSending && (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progreso de Envío</p>
                    <h4 className="text-2xl font-black text-ukblue dark:text-white leading-none">
                      {progress.current} <span className="text-slate-300 dark:text-slate-600">/ {progress.total}</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-ukorange">{progress.percentage}%</span>
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-1 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-ukblue to-indigo-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Éxitos: {progress.success}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Errores: {progress.errors}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl flex items-center space-x-3">
                   <i className="fas fa-exclamation-triangle text-amber-500 text-xs animate-pulse"></i>
                   <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight">Mantén esta pestaña abierta hasta completar</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Remitente</label>
                <input
                  type="text"
                  required
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-ukblue/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (@ukuepa.com)</label>
                <input
                  type="email"
                  required
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className={`w-full px-5 py-4 border rounded-2xl outline-none text-sm font-bold dark:text-white ${
                    !validateEmail(formData.fromEmail) ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatarios</label>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-white bg-ukblue px-4 py-2 rounded-xl">
                  <i className="fas fa-file-csv mr-2"></i> Masivo CSV
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              </div>

              {csvRecipients.length > 0 ? (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-ukblue dark:text-indigo-300 uppercase">
                      {csvRecipients.length} contactos listos
                    </span>
                  </div>
                  <button type="button" onClick={() => { setCsvRecipients([]); setProgress(p => ({...p, total: 0})); }} className="text-rose-500 font-black text-[10px] hover:underline">Cambiar archivo</button>
                </div>
              ) : (
                <input
                  type="email"
                  value={formData.toEmail}
                  onChange={(e) => setFormData({ ...formData, toEmail: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none"
                  placeholder="ejemplo@correo.com"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plantilla SendGrid</label>
              <select
                value={formData.templateId}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-700 dark:text-slate-200"
              >
                {loadingTemplates ? <option>Cargando templates...</option> : templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {status.message && (
              <div className={`p-4 rounded-2xl text-xs font-black ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {status.message}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isSending || loadingTemplates}
                className="flex-1 py-5 bg-ukblue hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center space-x-4 disabled:opacity-50"
              >
                {isSending ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                <span>{isSending ? 'Enviando Batch...' : 'Iniciar Envío'}</span>
              </button>
              
              {isSending && (
                <button
                  type="button"
                  onClick={() => setCancelRequest(true)}
                  className="px-8 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Detener
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* VISTA PREVIA (DERECHA) */}
      <div className="lg:col-span-6">
        <div className="sticky top-28 space-y-6">
          <div className="bg-slate-200 dark:bg-slate-800 rounded-[3rem] p-2 shadow-inner">
            <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[500px] flex flex-col shadow-sm">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-transparent">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-ukblue text-white flex items-center justify-center font-black text-lg shadow-lg">
                    {formData.fromName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{formData.fromName || 'Remitente'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formData.fromEmail}</p>
                    <div className="mt-2 h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                    <p className="mt-2 text-[10px] text-slate-400 font-bold">Para: <span className="text-ukblue dark:text-indigo-400 font-black">{csvRecipients.length > 0 ? `${csvRecipients.length} destinatarios` : (formData.toEmail || 'destinatario@correo.com')}</span></p>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-6 bg-white dark:bg-slate-950">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <i className="fas fa-envelope-open-text text-4xl text-ukblue/20 dark:text-indigo-500/20"></i>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-ukblue dark:text-indigo-300 tracking-tight leading-tight">
                    {selectedTemplate.name}
                  </h4>
                  <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">SendGrid ID: {formData.templateId || 'n/a'}</p>
                </div>
                
                <div className="w-full space-y-3 opacity-20">
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                  <div className="h-2 w-5/6 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto"></div>
                  <div className="h-2 w-4/6 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto"></div>
                </div>
              </div>

              <div className="p-8 text-center border-t border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10">
                <img src="https://fileuk.netlify.app/universidaduk.png" className="h-5 mx-auto opacity-30 dark:invert mb-2" alt="UK" />
                <p className="text-[8px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest">Panel de Mails UK - Universidad Uk</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-3 px-6 py-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Sistema de Prevención de cierre activo</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailForm;
