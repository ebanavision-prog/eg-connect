// Genera la "tarjeta visual" compartible de InviteScreen: una imagen PNG real,
// dibujada en un <canvas> en el navegador (sin backend, sin API de pago),
// con el avatar del usuario, su nombre/profesión, el logo de EG CONNECT y un
// código QR real que apunta al mismo link de invitación (`?ref=uid`) que ya
// genera InviteScreen. No hay nada simulado aquí: el PNG resultante es un
// archivo real, descargable y compartible tal cual.

import QRCode from 'qrcode';

// Proporción 9:16 — el mismo formato que usan las Stories de Instagram/
// Facebook/WhatsApp, que es el destino principal de esta tarjeta.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// Colores reales de la marca — leídos de src/index.css (@theme) para el
// fondo/acentos, y de Logo.tsx para el propio isotipo (ver LOGO_PATHS más
// abajo, copiado de ese archivo).
const COLOR_PRIMARY = '#15157D';
const COLOR_PRIMARY_CONTAINER = '#2E3192';
const COLOR_SECONDARY_CONTAINER = '#58FDC8';
const COLOR_LOGO_NAVY = '#1B2B48';
const COLOR_LOGO_TEAL = '#53B9C1';

const FONT_DISPLAY = 'Manrope, ui-sans-serif, sans-serif';
const FONT_SANS = 'Inter, ui-sans-serif, sans-serif';

export interface ShareCardOptions {
  name: string;
  profession?: string;
  avatarUrl?: string;
  inviteLink: string;
}

export interface ShareCardResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob | null;
  /** false si el avatar no pudo dibujarse (sin foto, error de carga, o CORS) y se usó un avatar de iniciales en su lugar. */
  avatarIncluded: boolean;
}

function loadImage(src: string, crossOrigin?: 'anonymous'): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFontsLoaded(): Promise<void> {
  // Si document.fonts no está disponible o la carga falla, seguimos igual:
  // el canvas cae a una fuente del sistema, se ve un poco distinto pero
  // el texto se dibuja correctamente de todas formas.
  try {
    if (!('fonts' in document)) return;
    await Promise.all([
      document.fonts.load(`900 72px ${FONT_DISPLAY}`),
      document.fonts.load(`700 48px ${FONT_DISPLAY}`),
      document.fonts.load(`600 40px ${FONT_SANS}`),
      document.fonts.load(`500 32px ${FONT_SANS}`),
    ]);
    await document.fonts.ready;
  } catch {
    // no-op — degradación honesta a la fuente por defecto del navegador
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  weight: string,
  family: string
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Isotipo de EG CONNECT — geometría de nodos/líneas copiada tal cual de
// Logo.tsx (viewBox 0 0 100 100). Se mantiene como constante aquí en vez de
// serializar el componente React en vivo para no montar DOM oculto solo
// para rasterizar un ícono; si Logo.tsx cambia de diseño, esta copia debe
// actualizarse a mano.
const LOGO_SVG = `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 15L78 33" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M50 15L22 33" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M50 15L50 50" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M78 33L50 50" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M22 33L50 50" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M78 33L78 67" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M22 33L22 67" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M50 50L78 67" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M50 50L22 67" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M50 50L50 85" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M78 67L50 85" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <path d="M22 67L50 85" stroke="${COLOR_LOGO_NAVY}" stroke-width="3.5" />
  <circle cx="50" cy="15" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="78" cy="33" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="22" cy="33" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="50" cy="50" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="78" cy="67" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="22" cy="67" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="50" cy="85" r="7.5" fill="${COLOR_LOGO_NAVY}" />
  <circle cx="12" cy="50" r="6.5" fill="${COLOR_LOGO_TEAL}" />
  <circle cx="88" cy="50" r="6.5" fill="${COLOR_LOGO_TEAL}" />
  <circle cx="50" cy="98" r="6.5" fill="${COLOR_LOGO_TEAL}" />
</svg>`.trim();

async function rasterizeLogo(): Promise<HTMLImageElement | null> {
  const blob = new Blob([LOGO_SVG], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Dibuja la tarjeta completa en un <canvas> nuevo y devuelve tanto el
 * canvas como un dataURL/Blob PNG listos para descargar o compartir.
 *
 * Si el avatar es una URL externa sin cabeceras CORS (poco probable hoy:
 * mientras VITE_FIREBASE_STORAGE_ENABLED sea false, el avatar es un
 * data: URL local, sin problema de CORS), dibujarlo puede "contaminar" el
 * canvas e impedir exportarlo. En ese caso, en vez de fallar, esta función
 * vuelve a generar la tarjeta sin el avatar (usando el círculo de iniciales)
 * para que la exportación siempre funcione.
 */
export async function generateShareCard(options: ShareCardOptions): Promise<ShareCardResult> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Este navegador no soporta canvas 2D — no se puede generar la tarjeta.');
  }

  await ensureFontsLoaded();

  // Fondo — gradiente con los mismos tonos primary/primary-container de la marca.
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, COLOR_PRIMARY);
  bg.addColorStop(1, COLOR_PRIMARY_CONTAINER);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Textura decorativa sutil — círculos translúcidos, en línea con los
  // adornos que ya usa InviteScreen (ver "Viral Perk Banner").
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(CARD_WIDTH - 60, 60, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, CARD_HEIGHT - 120, 220, 0, Math.PI * 2);
  ctx.fill();

  // Insignia blanca con el isotipo real de EG CONNECT.
  const badgeSize = 180;
  const badgeX = (CARD_WIDTH - badgeSize) / 2;
  const badgeY = 96;
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 48);
  ctx.fill();
  const logoImg = await rasterizeLogo();
  if (logoImg) {
    const pad = 34;
    ctx.drawImage(logoImg, badgeX + pad, badgeY + pad, badgeSize - pad * 2, badgeSize - pad * 2);
  }

  // Wordmark "EG CONNECT" + tagline, igual que Logo.tsx variant="light".
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 66px ${FONT_DISPLAY}`;
  ctx.fillText('EG CONNECT', CARD_WIDTH / 2, badgeY + badgeSize + 90);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `600 28px ${FONT_SANS}`;
  ctx.fillText('networking, entrepreneurship and accountability', CARD_WIDTH / 2, badgeY + badgeSize + 136);

  // Avatar — foto real si carga bien, si no, círculo de iniciales.
  const avatarSize = 340;
  const avatarCx = CARD_WIDTH / 2;
  const avatarCy = badgeY + badgeSize + 340;
  let avatarDrawn = false;

  let avatarImg: HTMLImageElement | null = null;
  if (options.avatarUrl) {
    const isDataUrl = options.avatarUrl.startsWith('data:');
    avatarImg = await loadImage(options.avatarUrl, isDataUrl ? undefined : 'anonymous');
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    // Recorte tipo "cover" para no deformar la foto.
    const scale = Math.max(avatarSize / avatarImg.width, avatarSize / avatarImg.height);
    const drawW = avatarImg.width * scale;
    const drawH = avatarImg.height * scale;
    ctx.drawImage(
      avatarImg,
      avatarCx - drawW / 2,
      avatarCy - drawH / 2,
      drawW,
      drawH
    );
    avatarDrawn = true;
  } else {
    ctx.fillStyle = COLOR_SECONDARY_CONTAINER;
    ctx.fillRect(avatarCx - avatarSize / 2, avatarCy - avatarSize / 2, avatarSize, avatarSize);
    ctx.fillStyle = COLOR_PRIMARY;
    ctx.font = `900 120px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(options.name), avatarCx, avatarCy + 8);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Anillo alrededor del avatar en el teal de marca.
  ctx.strokeStyle = COLOR_SECONDARY_CONTAINER;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Nombre y profesión.
  const textMaxWidth = CARD_WIDTH - 160;
  const nameY = avatarCy + avatarSize / 2 + 110;
  const nameSize = fitFontSize(ctx, options.name, textMaxWidth, 72, 40, '900', FONT_DISPLAY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${nameSize}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText(options.name, CARD_WIDTH / 2, nameY);

  let professionY = nameY;
  if (options.profession) {
    professionY = nameY + 56;
    const profSize = fitFontSize(ctx, options.profession, textMaxWidth, 38, 24, '600', FONT_SANS);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `600 ${profSize}px ${FONT_SANS}`;
    ctx.fillText(options.profession, CARD_WIDTH / 2, professionY);
  }

  // QR real — mismo link de invitación (?ref=uid) que ya usa InviteScreen.
  const qrBoxSize = 460;
  const qrBoxX = (CARD_WIDTH - qrBoxSize) / 2;
  const qrBoxY = CARD_HEIGHT - qrBoxSize - 220;
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 36);
  ctx.fill();

  try {
    const qrDataUrl = await QRCode.toDataURL(options.inviteLink, {
      width: qrBoxSize,
      margin: 1,
      color: { dark: COLOR_PRIMARY, light: '#FFFFFF' },
    });
    const qrImg = await loadImage(qrDataUrl);
    if (qrImg) {
      const qrPad = 36;
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2);
    }
  } catch (err) {
    // Si la generación del QR falla por algún motivo, la tarjeta se sigue
    // exportando igual (con el recuadro blanco vacío) en vez de romperse
    // por completo — el link sigue funcionando por los demás canales.
    console.error('No se pudo generar el código QR de la tarjeta:', err);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 32px ${FONT_SANS}`;
  ctx.fillText('Escanea para unirte a EG CONNECT', CARD_WIDTH / 2, qrBoxY + qrBoxSize + 64);

  // Exportar. Si el canvas quedó "contaminado" por un avatar cross-origin
  // sin CORS, toDataURL/toBlob lanzan un SecurityError — en ese caso
  // regeneramos la tarjeta completa sin ese avatar en vez de fallar.
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const blob = await canvasToBlob(canvas);
    return { canvas, dataUrl, blob, avatarIncluded: avatarDrawn };
  } catch (err) {
    if (options.avatarUrl) {
      console.warn('No se pudo exportar la tarjeta con el avatar (posible restricción CORS); generando sin foto.', err);
      return generateShareCard({ ...options, avatarUrl: undefined });
    }
    throw err;
  }
}
