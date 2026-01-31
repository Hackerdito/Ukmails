
// api/send-email.ts
import sgMail from '@sendgrid/mail';

export default async function handler(req: any, res: any) {
  // Siempre respondemos con JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', success: false });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error('API KEY faltante en el servidor');
    return res.status(500).json({ error: 'Configuración de servidor incompleta (SendGrid Key)', success: false });
  }

  try {
    sgMail.setApiKey(apiKey);

    const { toEmail, fromEmail, fromName, templateId, dynamicTemplateData } = req.body;

    if (!toEmail || !templateId) {
      return res.status(400).json({ error: 'Destinatario y plantilla son requeridos', success: false });
    }

    const msg = {
      to: toEmail,
      from: {
        email: fromEmail || 'info@ukuepa.com',
        name: fromName || 'Uk Mails'
      },
      templateId: templateId,
      dynamicTemplateData: dynamicTemplateData || {},
    };

    const [response] = await sgMail.send(msg);
    
    // Si llegamos aquí es un éxito de SendGrid (Status 2xx)
    return res.status(200).json({ 
      success: true, 
      message: 'Email procesado por SendGrid',
      statusCode: response.statusCode 
    });
  } catch (error: any) {
    const errorBody = error.response?.body || {};
    const errorMessage = errorBody.errors?.[0]?.message || error.message || 'Error desconocido al contactar SendGrid';
    
    console.error('SendGrid API Error:', errorMessage);
    
    return res.status(500).json({ 
      error: 'Error en el proveedor de correos', 
      details: errorMessage,
      success: false 
    });
  }
}
