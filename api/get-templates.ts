
// api/get-templates.ts
export default async function handler(req: any, res: any) {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'SendGrid API key not configured on server.' });
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/templates?generations=dynamic', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'Failed to fetch templates');
    }

    // Mapeamos solo lo necesario para el dropdown
    const templates = data.templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      updated_at: t.updated_at
    }));

    return res.status(200).json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({ error: 'Error fetching templates from SendGrid' });
  }
}
