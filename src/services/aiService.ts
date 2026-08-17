// Gemini nunca se llama directamente desde el navegador: la llave viviría en el
// bundle público (por eso el hallazgo de seguridad). En su lugar, este servicio
// llama a un proxy PHP alojado en el hosting existente (server/gemini-proxy.php)
// que guarda la llave del lado del servidor.
const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;

async function callProxy(action: string, payload: unknown) {
  if (!PROXY_URL) {
    console.warn('VITE_GEMINI_PROXY_URL no está configurada. Funciones de IA desactivadas.');
    return null;
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Error llamando al proxy de IA (${action}):`, error);
    return null;
  }
}

export async function extractContactFromImage(base64Image: string) {
  return callProxy('extractContact', { base64Image });
}

export async function generateActionSteps(context: string) {
  const result = await callProxy('actionSteps', { context });
  return Array.isArray(result) ? result : [];
}

export async function generateIcebreaker(contactName: string, role: string, company: string, tags: string[] = []) {
  const result = await callProxy('icebreaker', { contactName, role, company, tags });
  // No inventar una frase "de Gemini" cuando el proxy no responde: devolver null
  // para que la UI lo distinga de una sugerencia real en vez de hacer pasar un
  // texto fijo como si fuera IA genuina.
  return (result?.text as string) || null;
}
