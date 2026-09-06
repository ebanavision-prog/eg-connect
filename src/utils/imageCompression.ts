// Compresión de imágenes de perfil/empresa ANTES de guardarlas como base64.
//
// Por qué existe: mientras Storage esté apagado (VITE_FIREBASE_STORAGE_ENABLED
// en false, decisión de costo -- ver docs/PLAN_MEJORA_360.md Fase 4), los
// avatares se guardan como data: URL directo dentro del documento de
// Firestore en users/{uid}.avatar. Un documento de Firestore tiene un límite
// duro de 1 MiB. Una foto real de cámara de teléfono, sin comprimir, pesa
// típicamente 2-8 MB -- eso hace fallar el guardado (setDoc rechazado por el
// propio SDK antes de llegar a la red), sin ningún aviso claro al usuario más
// allá del error genérico de "no se pudo guardar".
//
// Esto redimensiona la imagen a un máximo razonable para un avatar circular
// (nunca se muestra más grande que unos cientos de píxeles en ningún punto
// de la app) y la re-codifica en JPEG con compresión, antes de convertirla a
// base64. El resultado real para una foto de cámara típica queda en el orden
// de 30-80 KB -- muy por debajo del límite de 1 MiB, con margen de sobra
// incluso para el resto de campos del documento.
export function compressImageToDataUrl(
  file: File,
  maxDimension = 512,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Sin contexto 2D disponible (no debería pasar en un navegador real) --
        // en vez de fallar el alta/guardado por completo, se cae al
        // comportamiento anterior (base64 sin comprimir) más que bloquear al
        // usuario.
        reject(new Error('No se pudo obtener el contexto 2D del canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen para comprimirla'));
    };

    img.src = objectUrl;
  });
}
