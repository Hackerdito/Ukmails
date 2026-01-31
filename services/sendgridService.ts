
import { EmailFormData } from '../types';

export const sendEmailViaSendGrid = async (data: EmailFormData) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseText = await response.text();
    let result: any = {};
    
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.warn("Respuesta no es JSON:", responseText);
      result = { error: 'Respuesta inválida del servidor', details: responseText };
    }

    if (!response.ok) {
      throw new Error(result.error || result.details || `Error ${response.status}`);
    }

    return result;
  } catch (error: any) {
    console.error('Error en Servicio SendGrid:', error.message);
    throw error;
  }
};
