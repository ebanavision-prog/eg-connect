import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, MessageSquare, WifiOff, X, LocateFixed, RefreshCw,
  Users, Loader2, ShieldQuestion, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, setUserLocationSharing } from '../services/firebaseService';
import { localDataService } from '../services/localDataService';

// Guinea Ecuatorial es la base de usuarios entera de esta app — nunca
// arrancar en una vista genérica de mundo/0,0. Malabo, zoom que muestra
// la ciudad completa sin estar demasiado alejado.
const MALABO_CENTER: [number, number] = [3.7523, 8.7742];
const DEFAULT_ZOOM = 13;
const MY_LOCATION_ZOOM = 14;

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop';

type LatLng = { lat: number; lng: number };

// Distancia real entre dos puntos (fórmula de Haversine) — nunca una cifra
// inventada tipo "200m". Si no tenemos la posición del usuario actual,
// simplemente no se calcula (ver honestDistanceLabel).
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// Construye el icono del pin como un elemento DOM real (no una cadena HTML)
// para que la URL del avatar nunca pueda inyectar marcado — se asigna como
// propiedad `.src`, no se interpola en un string.
function createAvatarIcon(avatarUrl: string | undefined, variant: 'self' | 'user'): L.DivIcon {
  const wrapper = document.createElement('div');
  wrapper.className = `relative w-11 h-11 rounded-full border-[3px] shadow-xl overflow-hidden bg-surface-container-high ${
    variant === 'self' ? 'border-secondary ring-4 ring-secondary/25' : 'border-white ring-2 ring-primary-container/30'
  }`;
  const img = document.createElement('img');
  img.src = avatarUrl || FALLBACK_AVATAR;
  img.alt = '';
  img.className = 'w-full h-full object-cover';
  wrapper.appendChild(img);
  return L.divIcon({ html: wrapper, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
}

// Recentra el mapa una sola vez cuando aparece una posición nueva (p.ej. al
// conseguir el primer fix de geolocalización), sin pelearse con el usuario
// si luego mueve o hace zoom manualmente.
function RecenterOnce({ position, zoom }: { position: LatLng | null; zoom: number }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (position && !done.current) {
      done.current = true;
      map.flyTo([position.lat, position.lng], zoom, { duration: 0.8 });
    }
  }, [position, zoom, map]);
  return null;
}

type GeoState = 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported';

interface MapScreenProps {
  users: any[];
  profileData: any;
  onContact: (user: any) => void;
  onUpdateProfile: (data: any) => void;
}

export default function MapScreen({ users, profileData, onContact, onUpdateProfile }: MapScreenProps) {
  const currentUid = auth.currentUser?.uid;

  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);

  const [sharing, setSharing] = useState<boolean>(profileData?.locationSharing === true);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [sharingError, setSharingError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());

  useEffect(() => {
    const unsubscribe = localDataService.onStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setGeoError('Este navegador no soporta geolocalización. Mostramos Malabo por defecto.');
      return Promise.resolve<LatLng | null>(null);
    }
    setGeoState('loading');
    setGeoError(null);
    return new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyPosition(coords);
          setGeoState('granted');
          resolve(coords);
        },
        (err) => {
          setGeoState('denied');
          setGeoError(
            err.code === err.PERMISSION_DENIED
              ? 'Rechazaste el permiso de ubicación. Mostramos Malabo por defecto y no podemos calcular distancias reales.'
              : 'No se pudo obtener tu ubicación ahora mismo. Mostramos Malabo por defecto.'
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, []);

  const handleToggleSharing = async () => {
    if (!currentUid) return;
    setSharingError(null);

    if (sharing) {
      // Apagar: nunca dejar una ubicación vieja flotando en la base de datos.
      setSharingBusy(true);
      try {
        await setUserLocationSharing(currentUid, null);
        setSharing(false);
        onUpdateProfile({ ...profileData, locationSharing: false, location: undefined });
      } catch {
        setSharingError('No se pudo desactivar el compartir. Inténtalo de nuevo.');
      } finally {
        setSharingBusy(false);
      }
      return;
    }

    // Encender: hace falta una posición real primero.
    let coords = myPosition;
    if (!coords) {
      coords = await requestLocation();
    }
    if (!coords) {
      setSharingError('Activa tu ubicación arriba antes de poder compartirla.');
      return;
    }
    setSharingBusy(true);
    try {
      await setUserLocationSharing(currentUid, coords);
      setSharing(true);
      onUpdateProfile({ ...profileData, locationSharing: true, location: { lat: coords.lat, lng: coords.lng } });
    } catch {
      setSharingError('No se pudo activar el compartir. Inténtalo de nuevo.');
    } finally {
      setSharingBusy(false);
    }
  };

  const handleRefreshLocation = async () => {
    const coords = await requestLocation();
    if (coords && sharing && currentUid) {
      try {
        await setUserLocationSharing(currentUid, coords);
        onUpdateProfile({ ...profileData, locationSharing: true, location: { lat: coords.lat, lng: coords.lng } });
      } catch {
        setSharingError('Se actualizó tu posición localmente, pero no se pudo guardar. Inténtalo de nuevo.');
      }
    }
  };

  // Solo gente que se apuntó de verdad: locationSharing===true, coordenadas
  // numéricas reales, nunca el propio usuario, y siempre respetando
  // privacyMode==='private' aunque por algún motivo tuviera ubicación guardada.
  const visibleUsers = useMemo(() => {
    return (users || []).filter((u) => {
      if (!u || u.uid === currentUid) return false;
      if (u.privacyMode === 'private') return false;
      if (u.locationSharing !== true) return false;
      const loc = u.location;
      return loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
    });
  }, [users, currentUid]);

  const searchedUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleUsers;
    return visibleUsers.filter((u) =>
      [u.name, u.profession, u.role, u.city].filter(Boolean).some((f) => String(f).toLowerCase().includes(term))
    );
  }, [visibleUsers, searchTerm]);

  const distanceLabelFor = (loc: LatLng): string | null => {
    if (!myPosition) return null;
    return formatDistance(haversineKm(myPosition, loc));
  };

  const selfIcon = useMemo(() => createAvatarIcon(profileData?.avatar, 'self'), [profileData?.avatar]);

  return (
    <div className="relative h-[calc(100vh-160px)] -mx-6 overflow-hidden">
      {/* Toast al seleccionar un pin */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-28 left-1/2 z-100 w-[calc(100%-3rem)] max-w-sm"
          >
            <div className="bg-surface-container-highest/95 backdrop-blur-md text-on-surface p-4 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-4">
              <img
                src={selectedUser.avatar || FALLBACK_AVATAR}
                alt={selectedUser.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70">
                  {distanceLabelFor(selectedUser.location) || 'Distancia no disponible'}
                </p>
                <p className="text-sm font-bold truncate">{selectedUser.name}</p>
                <p className="text-[10px] text-on-surface-variant font-medium truncate">
                  {selectedUser.profession || selectedUser.role || 'Miembro de EG Connect'}
                  {selectedUser.city ? ` · ${selectedUser.city}` : ''}
                </p>
              </div>
              <button
                onClick={() => onContact(selectedUser)}
                className="p-2.5 bg-primary text-white rounded-full shrink-0 active:scale-90 transition-transform outline-hidden"
                aria-label="Enviar mensaje"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 hover:bg-black/5 rounded-full outline-hidden transition-colors"
              >
                <X className="w-4 h-4 text-outline-variant" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mapa real (OpenStreetMap, sin clave/facturación) */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={MALABO_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-full" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterOnce position={myPosition} zoom={MY_LOCATION_ZOOM} />

          {myPosition && (
            <Marker position={[myPosition.lat, myPosition.lng]} icon={selfIcon} />
          )}

          {searchedUsers.map((u) => (
            <Marker
              key={u.uid}
              position={[u.location.lat, u.location.lng]}
              icon={createAvatarIcon(u.avatar, 'user')}
              eventHandlers={{ click: () => setSelectedUser(u) }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Badge de sin conexión — solo aparece si realmente estamos offline */}
      {!isOnline && (
        <div className="absolute top-24 right-6 z-30 flex items-center gap-2 bg-secondary-container px-3 py-1.5 rounded-full shadow-lg border border-white/20">
          <WifiOff className="w-3 h-3 text-on-secondary-container" />
          <span className="text-[10px] font-bold text-on-secondary-container uppercase tracking-widest">Sin Conexión</span>
        </div>
      )}

      {/* Controles flotantes: búsqueda + estado de ubicación */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-30 space-y-3">
        <div className="glass-effect p-2 rounded-full flex items-center shadow-lg">
          <div className="pl-4 pr-2 text-on-surface-variant">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Buscar contactos en el mapa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-on-surface w-full font-sans text-sm outline-hidden"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-2 text-on-surface-variant outline-hidden">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {geoState !== 'granted' && (
          <div className="glass-effect rounded-[1.5rem] p-4 shadow-lg space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldQuestion className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-on-surface">Activa tu ubicación</p>
                <p className="text-[11px] text-on-surface-variant leading-snug mt-0.5">
                  {geoError || 'Para centrar el mapa donde estás y calcular distancias reales, necesitamos tu ubicación del navegador. Nunca se comparte con nadie hasta que tú lo actives abajo.'}
                </p>
              </div>
            </div>
            <button
              onClick={requestLocation}
              disabled={geoState === 'loading'}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-full font-bold text-xs disabled:opacity-60 active:scale-95 transition-all outline-hidden"
            >
              {geoState === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Buscando tu posición...</>
              ) : (
                <><LocateFixed className="w-4 h-4" />Usar mi ubicación</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Panel de compartir ubicación + refrescar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30">
        <div className="bg-surface-container-lowest rounded-[2.5rem] p-6 shadow-2xl border-t border-white ring-1 ring-black/5 space-y-4">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${sharing ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
              {sharing ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold font-display text-primary">Compartir mi ubicación</h3>
              <p className="text-[11px] text-on-surface-variant leading-snug">
                {sharing
                  ? 'Otros miembros de EG Connect pueden verte en este mapa.'
                  : 'Solo tú ves tu posición. Actívalo para aparecer en el mapa de otros.'}
              </p>
            </div>
            <button
              onClick={handleToggleSharing}
              disabled={sharingBusy || !currentUid}
              className={`w-12 h-7 rounded-full transition-all relative shrink-0 disabled:opacity-50 outline-hidden ${sharing ? 'bg-secondary' : 'bg-surface-container-high'}`}
              role="switch"
              aria-checked={sharing}
              aria-label="Compartir mi ubicación"
            >
              {sharingBusy ? (
                <Loader2 className="w-4 h-4 animate-spin absolute top-1.5 left-1/2 -translate-x-1/2 text-on-surface-variant" />
              ) : (
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${sharing ? 'left-6' : 'left-1'}`} />
              )}
            </button>
          </div>

          {sharingError && <p className="text-[11px] font-bold text-error text-center">{sharingError}</p>}

          {myPosition && (
            <button
              onClick={handleRefreshLocation}
              disabled={geoState === 'loading'}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-container-low text-primary rounded-full font-bold text-[11px] disabled:opacity-60 active:scale-95 transition-all outline-hidden"
            >
              {geoState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualizar mi posición
            </button>
          )}

          {visibleUsers.length === 0 && (
            <div className="flex items-center gap-3 pt-1 border-t border-outline/10">
              <Users className="w-4 h-4 text-on-surface-variant/50 shrink-0 mt-3" />
              <p className="text-[11px] text-on-surface-variant/70 leading-snug pt-3">
                Todavía nadie ha activado compartir ubicación. Actívalo tú y sé el primero en el mapa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
