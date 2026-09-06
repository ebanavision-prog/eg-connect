import { useMemo } from 'react';
import { ArrowLeft, Users, TrendingUp, Share2, Award, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../types';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { REFERRAL_GOAL } from './InviteScreen';

// Panel de crecimiento -- solo lectura, gateado a isAdmin en el sidebar
// (mismo patrón que los botones admin de CompaniesScreen.tsx/TendersScreen.tsx:
// se oculta en la UI, no es una regla de Firestore nueva -- firestore.rules
// ya permite `list` de users/ a cualquier usuario logueado, esto no cambia
// esa superficie, solo la organiza).
//
// Todos los números salen de un único `useFirestoreCollection('users')` real
// (mismo hook que ya usa el resto de la app) -- nada se fabrica ni se
// aproxima. Con el volumen esperado en esta fase (decenas/cientos de
// usuarios, ver docs/EVALUACION_BLAZE_COSTOS_2026-09-05.md) traer la
// colección completa una vez y calcular en el cliente es exactamente el
// mismo patrón ya usado en `getAllUsers(100)` -- no una query nueva.
export default function GrowthAnalyticsScreen({ onBack, profileData }: { onBack: () => void; profileData: UserProfile | null }) {
  const { t } = useTranslation();
  const { data: users, loading } = useFirestoreCollection<UserProfile>('users');

  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const toMillis = (ts: unknown): number | null => {
      if (ts && typeof ts === 'object' && 'toDate' in (ts as any)) {
        return (ts as { toDate: () => Date }).toDate().getTime();
      }
      return null;
    };

    const totalUsers = users.length;
    const signups7d = users.filter((u) => {
      const t = toMillis(u.createdAt);
      return t !== null && now - t <= 7 * DAY;
    }).length;
    const signups30d = users.filter((u) => {
      const t = toMillis(u.createdAt);
      return t !== null && now - t <= 30 * DAY;
    }).length;
    const active7d = users.filter((u) => {
      const t = toMillis(u.lastActiveAt);
      return t !== null && now - t <= 7 * DAY;
    }).length;
    const referredUsers = users.filter((u) => !!u.referredBy);
    const referredPct = totalUsers > 0 ? Math.round((referredUsers.length / totalUsers) * 100) : 0;

    // Ranking real de quién trajo más gente -- cuenta cuántos usuarios tienen
    // a cada uid como referredBy, no un número inventado.
    const referralCounts = new Map<string, number>();
    for (const u of users) {
      if (u.referredBy) {
        referralCounts.set(u.referredBy, (referralCounts.get(u.referredBy) || 0) + 1);
      }
    }
    const topReferrers = Array.from(referralCounts.entries())
      .map(([uid, count]) => ({
        uid,
        count,
        name: users.find((u) => u.uid === uid)?.name || t('growthAnalytics.unknownUser')
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const ambassadors = Array.from(referralCounts.values()).filter((c) => c >= REFERRAL_GOAL).length;

    return { totalUsers, signups7d, signups30d, active7d, referredPct, topReferrers, ambassadors };
  }, [users, t]);

  if (!profileData?.isAdmin) {
    // Defensivo -- el sidebar ya oculta el link para quien no es admin
    // (mismo criterio que el resto de gates isAdmin de la app: promesa de
    // UI, la lectura real de users/ ya está abierta a cualquier signed-in
    // por diseño de firestore.rules, esto no es una barrera de seguridad).
    return (
      <div className="py-6 max-w-xl mx-auto text-center space-y-4">
        <p className="text-on-surface-variant font-medium">{t('growthAnalytics.notAuthorized')}</p>
        <button onClick={onBack} className="text-primary font-bold underline">{t('growthAnalytics.goBack')}</button>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 rounded-full hover:bg-surface-container-high transition-all focus-ring-custom" aria-label={t('growthAnalytics.backAria')}>
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="font-display font-extrabold text-3xl text-primary tracking-tight">{t('growthAnalytics.title')}</h1>
      </div>

      {loading ? (
        <p className="text-on-surface-variant font-medium px-1">{t('growthAnalytics.loading')}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low rounded-[1.5rem] p-5 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('growthAnalytics.totalUsers')}</span>
              </div>
              <p className="text-3xl font-extrabold text-on-surface">{stats.totalUsers}</p>
            </div>
            <div className="bg-surface-container-low rounded-[1.5rem] p-5 space-y-1">
              <div className="flex items-center gap-2 text-secondary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('growthAnalytics.signups7d')}</span>
              </div>
              <p className="text-3xl font-extrabold text-on-surface">{stats.signups7d}</p>
              <p className="text-[10px] text-on-surface-variant font-medium">{t('growthAnalytics.signups30d', { count: stats.signups30d })}</p>
            </div>
            <div className="bg-surface-container-low rounded-[1.5rem] p-5 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('growthAnalytics.active7d')}</span>
              </div>
              <p className="text-3xl font-extrabold text-on-surface">{stats.active7d}</p>
            </div>
            <div className="bg-surface-container-low rounded-[1.5rem] p-5 space-y-1">
              <div className="flex items-center gap-2 text-secondary">
                <Share2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('growthAnalytics.referredPct')}</span>
              </div>
              <p className="text-3xl font-extrabold text-on-surface">{stats.referredPct}%</p>
              <p className="text-[10px] text-on-surface-variant font-medium">{t('growthAnalytics.ambassadorCount', { count: stats.ambassadors })}</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Award className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest text-primary">{t('growthAnalytics.topReferrersTitle')}</h2>
            </div>
            {stats.topReferrers.length === 0 ? (
              <p className="text-on-surface-variant font-medium px-1">{t('growthAnalytics.noReferralsYet')}</p>
            ) : (
              <div className="space-y-2">
                {stats.topReferrers.map((r, i) => (
                  <div key={r.uid} className="flex items-center justify-between bg-surface-container-low rounded-2xl px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-on-surface-variant/50 w-4">{i + 1}</span>
                      <span className="font-bold text-on-surface">{r.name}</span>
                    </div>
                    <span className="text-sm font-extrabold text-primary">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
