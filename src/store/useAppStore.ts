/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { UserProfile } from '../types';

// Fase 1 de la adopción de un store ligero (ver docs/PLAN_MEJORA_360.md,
// secciones 5 y 7 — Fase 1: "Extraer store ligero (Zustand/Context) para
// currentUser/realUsers/notifications").
//
// Alcance deliberadamente mínimo: este store SOLO reemplaza dónde VIVEN
// `profileData`/`realUsers` (antes `useState` en App.tsx). App.tsx sigue
// pasándolos hacia abajo como props a cada pantalla hija exactamente igual
// que antes — ninguna pantalla lee del store todavía.
//
// Fase 1.5 (pendiente, no implementada aquí): migrar las pantallas hijas para
// que lean `currentUserProfile`/`realUsers` directamente de este store en vez
// de recibirlos por props desde App.tsx. Eso eliminaría el prop-drilling real
// (App.tsx pasándolos a mano a las ~14 pantallas que los usan), pero se dejó
// fuera de esta sesión a propósito: tocar las ~14 pantallas para que dejen de
// depender de props y empiecen a depender del store es un cambio de mayor
// superficie, y en este entorno no hay forma de verificar visualmente que
// nada se rompió (sin extensión de Chrome disponible). Ver el mandato de la
// tarea: "prioriza no romper nada por encima del refactor perfecto".
//
// Cuando se haga la Fase 1.5, este store también sería el lugar natural para
// las `notifications` de `useAppNotifications` (mencionado en el plan), no
// solo `currentUserProfile`/`realUsers`.
interface AppStore {
  currentUserProfile: UserProfile | null;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  realUsers: UserProfile[];
  setRealUsers: (users: UserProfile[]) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentUserProfile: null,
  setCurrentUserProfile: (profile) => set({ currentUserProfile: profile }),
  realUsers: [],
  setRealUsers: (users) => set({ realUsers: users }),
}));
