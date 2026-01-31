
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
    fromName: 'Uk Mails Admin',
    toEmail: '',
    templateId: '',
    dynamicTemplateData: ''
  });

  const [templates, setTemplates] = useState<SendGridTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [csvRecipients, setCsvRecipients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        }
      },
    });
  };

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targets = csvRecipients.length > 0 ? csvRecipients : [formData.toEmail].filter(em => em.trim() !== '');
    if (targets.length === 0) {
      setStatus({ type: 'error', message: 'Indica destinatarios' });
      return;
    }

    setIsSending(true);
    setCancelRequest(false);
    setStatus({ type: '', message: '' });

    let successCount = 0;
    let finalStatus: 'success' | 'error' | 'cancelled' = 'success';
    let errorMessage = '';

    try {
      for (const email of targets) {
        if (cancelRequest) {
          finalStatus = 'cancelled';
          break;
        }
        try {
          await sendEmailViaSendGrid({ ...formData, toEmail: email.trim() });
          successCount++;
        } catch (mailErr: any) {
          if (targets.length === 1) {
            finalStatus = 'error';
            errorMessage = mailErr.message;
            throw mailErr;
          }
        }
      }
      
      if (finalStatus === 'success') {
        setStatus({ type: 'success', message: `¡Enviado! ${successCount} correos exitosos.` });
      }
    } catch (error: any) {
      finalStatus = 'error';
      errorMessage = error.message;
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    } finally {
      // ESTA FUNCIÓN ES LA QUE ESCRIBE EN FIREBASE DATA
      await saveEmailLog({
        templateName: selectedTemplate.name,
        templateId: formData.templateId,
        count: successCount > 0 ? successCount : targets.length,
        status: finalStatus,
        fromEmail: formData.fromEmail,
        error: errorMessage
      });
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-6xl mx-auto">
      <div className="lg:col-span-6 space-y-6">
        <form onSubmit={handleSendEmails} className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-ukblue px-10 py-8 text-white">
            <h2 className="text-xl font-black flex items-center tracking-tighter">
              <i className="fas fa-magic mr-3 text-indigo-400"></i>
              Enviar Template
            </h2>
          </div>

          <div className="p-10 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Remitente</label>
                <input
                  type="text"
                  required
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none"
                  placeholder="Ej: Admisiones UK"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (@ukuepa.com)</label>
                <input
                  type="email"
                  required
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatarios</label>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-white bg-ukblue px-4 py-2 rounded-xl">
                  <i className="fas fa-file-csv mr-2"></i> CSV Masivo
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              </div>

              {csvRecipients.length > 0 ? (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex justify-between items-center">
                  <span className="text-xs font-black text-ukblue dark:text-indigo-300 uppercase">
                    {csvRecipients.length} contactos listos
                  </span>
                  <button type="button" onClick={() => setCsvRecipients([])} className="text-rose-500 font-black text-[10px]">Quitar</button>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plantilla</label>
              <select
                value={formData.templateId}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-700 dark:text-slate-200"
              >
                {loadingTemplates ? <option>Cargando...</option> : templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {status.message && (
              <div className={`p-4 rounded-2xl text-xs font-black ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSending || loadingTemplates}
              className="w-full py-5 bg-ukblue hover:bg-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center space-x-4 disabled:opacity-50"
            >
              {isSending ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
              <span>{isSending ? 'Enviando Batch...' : 'Enviar Ahora'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-6">
        <div className="sticky top-28 space-y-6">
          <div className="bg-slate-200 dark:bg-slate-800 rounded-[3rem] p-2">
            <div className="bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[480px] flex flex-col">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-ukblue dark:text-indigo-300 font-bold">
                    {formData.fromName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{formData.fromName || 'Uk Admin'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">Para: {csvRecipients.length > 0 ? `${csvRecipients.length} contactos` : (formData.toEmail || 'destinatario@correo.com')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-4">
                <i className="fas fa-envelope-open-text text-5xl text-ukblue/10 dark:text-white/10"></i>
                <div>
                  <h4 className="text-lg font-black text-ukblue dark:text-indigo-400">{selectedTemplate.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">ID: {formData.templateId || 'Sin seleccionar'}</p>
                </div>
                <div className="w-full max-w-[200px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                <div className="w-full max-w-[150px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
              </div>

              <div className="p-8 text-center border-t border-slate-50 dark:border-slate-800">
                <img src="https://fileuk.netlify.app/universidaduk.png" className="h-4 mx-auto opacity-30 dark:invert" alt="Uk" />
              </div>
            </div>
          </div>
          <div className="p-6 bg-ukblue/5 dark:bg-indigo-950/20 rounded-3xl border border-ukblue/10 dark:border-indigo-500/10 text-center">
             <p className="text-[10px] font-black text-ukblue dark:text-indigo-400 uppercase">Vista previa en tiempo real</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailForm;
