
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
  const [currentProcessingEmail, setCurrentProcessingEmail] = useState('');
  
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

  // Parse manual emails from string
  const manualEmails = useMemo(() => {
    if (!formData.toEmail) return [];
    return formData.toEmail
      .split(/[,;\s\n]+/)
      .map(e => e.trim())
      .filter(e => e !== '' && e.includes('@'));
  }, [formData.toEmail]);

  // Prevenir cierre de pestaña accidentalmente
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSending) {
        e.preventDefault();
        e.returnValue = '¡Atención! Hay un envío masivo en curso. Si cierras ahora, el proceso se detendrá.';
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

  const validateFromEmail = (email: string) => email && email.toLowerCase().endsWith('@ukuepa.com');

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
          // Clear manual input if CSV is uploaded to avoid confusion
          setFormData(prev => ({ ...prev, toEmail: '' }));
        }
      },
    });
  };

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = csvRecipients.length > 0 ? csvRecipients : manualEmails;
    const total = targets.length;

    if (total === 0) {
      setStatus({ type: 'error', message: 'Indica al menos un destinatario válido' });
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
      setCurrentProcessingEmail(email);
      
      try {
        await sendEmailViaSendGrid({ ...formData, toEmail: email });
        successLocal++;
      } catch (mailErr: any) {
        errorsLocal++;
        console.error(`Fallo envío a ${email}:`, mailErr.message);
      }

      // Actualizar progreso UI inmediatamente
      const current = i + 1;
      setProgress({
        total,
        current,
        success: successLocal,
        errors: errorsLocal,
        percentage: Math.round((current / total) * 100)
      });
    }

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
      message: cancelRequest ? 'Envío detenido manualmente.' : `Proceso completo: ${successLocal} enviados con éxito.` 
    });
    
    setIsSending(false);
    setCurrentProcessingEmail('');
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
          </div>

          <div className="p-10 space-y-6">
            {/* SISTEMA DE PROGRESO MEJORADO */}
            {isSending && (
              <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[2rem] border-2 border-ukblue/5 dark:border-indigo-500/10 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado del Lote</p>
                    <div className="flex items-baseline space-x-2">
                      <h4 className="text-4xl font-black text-ukblue dark:text-white leading-none tabular-nums">
                        {progress.current}
                      </h4>
                      <span className="text-sm font-bold text-slate-300 dark:text-slate-600 uppercase">de {progress.total}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-ukorange uppercase tracking-widest mb-1">Completado</p>
                    <span className="text-5xl font-black text-ukorange tabular-nums">{progress.percentage}%</span>
                  </div>
                </div>

                {/* Barra de Progreso Mejorada */}
                <div className="space-y-2">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700/50 rounded-2xl overflow-hidden p-1.5 shadow-inner relative">
                    <div 
                      className="h-full bg-gradient-to-r from-ukblue via-indigo-600 to-indigo-400 rounded-xl transition-all duration-700 ease-out relative shadow-lg"
                      style={{ width: `${progress.percentage}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[70%]">
                      <i className="fas fa-spinner fa-spin mr-2"></i> Procesando: <span className="text-slate-600 dark:text-slate-300 lowercase">{currentProcessingEmail}</span>
                    </p>
                    <div className="flex space-x-3">
                       <span className="text-[9px] font-black text-emerald-600">✓ {progress.success}</span>
                       <span className="text-[9px] font-black text-rose-500">✕ {progress.errors}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-ukblue/5 dark:bg-indigo-950/20 rounded-2xl flex items-center space-x-4 border border-ukblue/10">
                   <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      <i className="fas fa-lock text-ukblue dark:text-indigo-400 animate-pulse"></i>
                   </div>
                   <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase leading-relaxed">
                     Panel protegido. No cierres el navegador para garantizar que todos los correos se entreguen.
                   </p>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Remitente</label>
                <input
                  type="email"
                  required
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className={`w-full px-5 py-4 border rounded-2xl outline-none text-sm font-bold dark:text-white transition-all ${
                    !validateFromEmail(formData.fromEmail) ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-ukblue'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatarios</label>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-white bg-ukblue hover:bg-slate-800 px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95">
                    <i className="fas fa-file-csv mr-2"></i> Cargar CSV
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                </div>
              </div>

              {csvRecipients.length > 0 ? (
                <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                       <i className="fas fa-users text-xs"></i>
                    </div>
                    <span className="text-xs font-black text-ukblue dark:text-indigo-300 uppercase tracking-tight">
                      {csvRecipients.length} contactos del CSV listos
                    </span>
                  </div>
                  <button type="button" onClick={() => { setCsvRecipients([]); setProgress(p => ({...p, total: 0})); }} className="text-rose-500 font-black text-[10px] hover:bg-rose-50 p-2 rounded-lg transition-all uppercase">Eliminar</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={formData.toEmail}
                      onChange={(e) => setFormData({ ...formData, toEmail: e.target.value })}
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-ukblue transition-all min-h-[100px] resize-none"
                      placeholder="Escribe correos separados por coma, espacio o enter..."
                    />
                    <i className="fas fa-at absolute left-5 top-6 text-slate-300"></i>
                  </div>
                  {manualEmails.length > 0 && (
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[10px] font-black text-ukblue dark:text-indigo-400 uppercase tracking-widest">
                        {manualEmails.length} correos detectados manualmente
                      </p>
                      <button type="button" onClick={() => setFormData({...formData, toEmail: ''})} className="text-[9px] font-black text-rose-500 uppercase hover:underline">Limpiar</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plantilla SendGrid</label>
              <div className="relative">
                <select
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-700 dark:text-slate-200 outline-none appearance-none focus:border-ukblue transition-all"
                >
                  {loadingTemplates ? <option>Cargando templates...</option> : templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
              </div>
            </div>

            {status.message && (
              <div className={`p-5 rounded-2xl text-[11px] font-black uppercase tracking-tight flex items-center space-x-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                <i className={`fas ${status.type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                <span>{status.message}</span>
              </div>
            )}

            <div className="flex space-x-4 pt-2">
              <button
                type="submit"
                disabled={isSending || loadingTemplates}
                className="flex-1 py-5 bg-ukblue hover:bg-slate-800 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-4 disabled:opacity-50 shadow-xl active:scale-95"
              >
                {isSending ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                <span>{isSending ? 'Procesando Lote...' : 'Lanzar Campaña'}</span>
              </button>
              
              {isSending && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Detener el envío? Los correos ya procesados no podrán recuperarse.')) {
                      setCancelRequest(true);
                    }
                  }}
                  className="px-8 bg-rose-500 hover:bg-rose-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                >
                  Detener
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* VISTA PREVIA MEJORADA */}
      <div className="lg:col-span-6">
        <div className="sticky top-28 space-y-6">
          <div className="bg-slate-200 dark:bg-slate-800 rounded-[3rem] p-2 shadow-inner group">
            <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[520px] flex flex-col shadow-sm transition-all group-hover:shadow-xl">
              <div className="p-10 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-transparent">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 rounded-2xl bg-ukblue text-white flex items-center justify-center font-black text-xl shadow-lg transform transition-transform group-hover:scale-110">
                    {formData.fromName.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-black text-slate-900 dark:text-white leading-none mb-1">{formData.fromName || 'Universidad Uk'}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">{formData.fromEmail}</p>
                    <div className="mt-4 h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                    <div className="mt-3 flex items-center space-x-2">
                       <span className="text-[10px] text-slate-400 font-bold">Para:</span>
                       <span className="text-[10px] text-ukblue dark:text-indigo-400 font-black truncate max-w-[200px]">
                         {csvRecipients.length > 0 ? `${csvRecipients.length} contactos del archivo` : (manualEmails.length > 0 ? `${manualEmails.length} contactos manuales` : 'destinatario@correo.com')}
                       </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-8 bg-white dark:bg-slate-950">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 relative">
                  <i className="fas fa-envelope-open-text text-5xl text-ukblue/10 dark:text-indigo-500/20"></i>
                  {isSending && (
                     <div className="absolute -top-2 -right-2 w-8 h-8 bg-ukorange rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                        <i className="fas fa-paper-plane text-white text-[10px] animate-bounce"></i>
                     </div>
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="text-2xl font-black text-ukblue dark:text-indigo-300 tracking-tight leading-tight">
                    {selectedTemplate.name}
                  </h4>
                  <div className="inline-flex items-center px-4 py-1 bg-slate-50 dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">SendGrid ID: {formData.templateId || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="w-full space-y-3 opacity-20">
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                  <div className="h-2.5 w-5/6 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto"></div>
                  <div className="h-2.5 w-4/6 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto"></div>
                </div>
              </div>

              <div className="p-10 text-center border-t border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10">
                <img src="https://fileuk.netlify.app/universidaduk.png" className="h-6 mx-auto opacity-40 dark:invert mb-3" alt="UK" />
                <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em]">Panel Oficial de Comunicaciones UK</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-4 px-8 py-5 bg-emerald-50 dark:bg-emerald-950/20 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
             <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
             </div>
             <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Monitoreo de Envío en Tiempo Real</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailForm;
