import { useMemo } from 'react';
import { Search, Users, Building2, ShoppingBag, Calendar, Rocket, Briefcase, MessageSquare, ChevronRight } from 'lucide-react';
import { Company, ServicePost, Event, Initiative, LocalContentOpportunity } from '../types';
import { auth } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface SearchResultsScreenProps {
  query: string;
  users: any[];
  onContact: (participant: { id: string; name: string; avatar: string }) => void;
  onNavigate: (screen: string) => void;
}

const norm = (s: string | undefined | null) => (s || '').toLowerCase();

export default function SearchResultsScreen({ query, users, onContact, onNavigate }: SearchResultsScreenProps) {
  const currentUid = auth.currentUser?.uid;
  const q = norm(query);

  const { data: companies } = useFirestoreCollection<Company & { ownerId?: string }>(currentUid ? 'companies' : null);
  const { data: posts } = useFirestoreCollection<ServicePost>(currentUid ? 'marketplace_posts' : null);
  const { data: events } = useFirestoreCollection<Event>(currentUid ? 'events' : null);
  const { data: initiatives } = useFirestoreCollection<Initiative>(currentUid ? 'initiatives' : null);
  const { data: tenders } = useFirestoreCollection<LocalContentOpportunity>(currentUid ? 'tenders' : null);

  const matchedUsers = useMemo(() =>
    q ? users.filter((u) =>
      u.uid !== currentUid && u.privacyMode !== 'private' &&
      (norm(u.name).includes(q) || norm(u.profession).includes(q) || norm(u.city).includes(q))
    ).slice(0, 5) : [],
    [users, q, currentUid]
  );

  const matchedCompanies = useMemo(() =>
    q ? companies.filter((c) => norm(c.name).includes(q) || norm(c.industry).includes(q)).slice(0, 5) : [],
    [companies, q]
  );

  const matchedPosts = useMemo(() =>
    q ? posts.filter((p) => norm(p.title).includes(q) || norm(p.description).includes(q)).slice(0, 5) : [],
    [posts, q]
  );

  const matchedEvents = useMemo(() =>
    q ? events.filter((e) => norm(e.title).includes(q) || norm(e.location).includes(q)).slice(0, 5) : [],
    [events, q]
  );

  const matchedInitiatives = useMemo(() =>
    q ? initiatives.filter((i) => norm(i.title).includes(q) || norm(i.description).includes(q)).slice(0, 5) : [],
    [initiatives, q]
  );

  const matchedTenders = useMemo(() =>
    q ? tenders.filter((t) => norm(t.title).includes(q) || norm(t.companyName).includes(q)).slice(0, 5) : [],
    [tenders, q]
  );

  const totalResults = matchedUsers.length + matchedCompanies.length + matchedPosts.length +
    matchedEvents.length + matchedInitiatives.length + matchedTenders.length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Búsqueda</h2>
        <h1 className="text-3xl font-extrabold font-display text-on-surface">"{query}"</h1>
        <p className="text-on-surface-variant text-sm mt-2">
          {totalResults > 0 ? `${totalResults} resultados en toda la red` : 'Sin resultados'}
        </p>
      </header>

      {totalResults === 0 && (
        <div className="text-center py-20 px-8 opacity-40">
          <Search className="w-12 h-12 mx-auto mb-4" />
          <p className="font-bold">No encontramos nada con ese término</p>
          <p className="text-xs">Prueba con otro nombre, empresa o palabra clave.</p>
        </div>
      )}

      {matchedUsers.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <Users className="w-4 h-4" /> Personas
          </h3>
          <div className="space-y-2">
            {matchedUsers.map((u) => (
              <div key={u.uid} className="flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem]">
                <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{u.name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{u.profession || u.role}</p>
                </div>
                <button onClick={() => onContact({ id: u.uid, name: u.name, avatar: u.avatar })} className="p-2.5 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {matchedCompanies.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <Building2 className="w-4 h-4" /> Empresas
          </h3>
          <div className="space-y-2">
            {matchedCompanies.map((c) => (
              <button key={c.id} onClick={() => onNavigate('companies')} className="w-full flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem] text-left hover:border-primary/20 transition-all">
                <img src={c.logo} alt={c.name} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{c.name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{c.industry}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      {matchedPosts.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <ShoppingBag className="w-4 h-4" /> Marketplace
          </h3>
          <div className="space-y-2">
            {matchedPosts.map((p) => (
              <button key={p.id} onClick={() => onNavigate('marketplace')} className="w-full flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem] text-left hover:border-primary/20 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{p.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">{p.authorName} · {p.category}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      {matchedEvents.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <Calendar className="w-4 h-4" /> Eventos
          </h3>
          <div className="space-y-2">
            {matchedEvents.map((e) => (
              <button key={e.id} onClick={() => onNavigate('events')} className="w-full flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem] text-left hover:border-primary/20 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{e.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">{e.location} · {e.date}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      {matchedInitiatives.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <Rocket className="w-4 h-4" /> Iniciativas
          </h3>
          <div className="space-y-2">
            {matchedInitiatives.map((i) => (
              <button key={i.id} onClick={() => onNavigate('initiatives')} className="w-full flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem] text-left hover:border-primary/20 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{i.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">{i.members?.length || 0} colaboradores</p>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}

      {matchedTenders.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest px-1">
            <Briefcase className="w-4 h-4" /> Licitaciones
          </h3>
          <div className="space-y-2">
            {matchedTenders.map((t) => (
              <button key={t.id} onClick={() => onNavigate('tenders')} className="w-full flex items-center gap-4 p-4 bg-white border border-outline/10 rounded-[1.5rem] text-left hover:border-primary/20 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface truncate">{t.title}</p>
                  <p className="text-xs text-on-surface-variant truncate">{t.companyName}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
