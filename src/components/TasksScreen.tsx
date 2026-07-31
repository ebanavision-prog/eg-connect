import { useState, useMemo } from 'react';
import { CheckCircle2, Circle, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { Task } from '../types';
import { auth, createTask, toggleTaskCompletion, deleteTask } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

const PRIORITIES: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'high', label: 'Alta', color: 'text-error' },
  { value: 'medium', label: 'Media', color: 'text-secondary' },
  { value: 'low', label: 'Baja', color: 'text-on-surface-variant' }
];

export default function TasksScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newNote, setNewNote] = useState('');

  const currentUid = auth.currentUser?.uid;
  const { data: tasks, loading } = useFirestoreCollection<Task>(
    currentUid ? `users/${currentUid}/tasks` : null
  );

  const { pending, done } = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
    return {
      pending: sorted.filter((t) => !t.completed),
      done: sorted.filter((t) => t.completed)
    };
  }, [tasks]);

  const handleAdd = async () => {
    if (!currentUid || !newTitle.trim()) return;
    setSaving(true);
    try {
      await createTask(currentUid, {
        title: newTitle.trim(),
        priority: newPriority,
        note: newNote.trim() || null
      });
      setIsModalOpen(false);
      setNewTitle('');
      setNewPriority('medium');
      setNewNote('');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (task: Task) => {
    if (!currentUid) return;
    toggleTaskCompletion(currentUid, task.id, !task.completed);
  };

  const handleDelete = (task: Task) => {
    if (!currentUid) return;
    deleteTask(currentUid, task.id);
  };

  const renderTask = (task: Task) => (
    <div key={task.id} className="editorial-card p-6 flex items-start gap-4 border-none shadow-md hover:shadow-xl transition-all">
      <button onClick={() => handleToggle(task)} className="pt-0.5 text-primary shrink-0">
        {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6 text-outline-variant" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-bold font-display tracking-widest uppercase ${
            task.priority === 'high' ? 'text-error' : task.priority === 'medium' ? 'text-secondary' : 'text-on-surface-variant opacity-60'
          }`}>
            Prioridad {PRIORITIES.find((p) => p.value === task.priority)?.label}
          </span>
        </div>
        <p className={`font-display font-bold text-xl mb-1 ${task.completed ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
          {task.title}
        </p>
        {task.note && (
          <p className="text-on-surface-variant text-sm font-medium leading-relaxed bg-surface-container-low p-2 rounded-xl border border-white/50 mt-2">
            {task.note}
          </p>
        )}
      </div>
      <button onClick={() => handleDelete(task)} className="text-outline-variant hover:text-error transition-colors p-2 outline-hidden shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="py-6 space-y-10">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Productividad</h2>
          <h3 className="font-display font-bold text-3xl text-primary tracking-tight">Mis Tareas</h3>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all outline-hidden"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {!loading && tasks.length === 0 && (
          <div className="editorial-card p-10 text-center border-dashed border-2 shadow-none">
            <CheckCircle2 className="w-8 h-8 text-outline/40 mx-auto mb-3" />
            <p className="text-sm font-bold text-on-surface-variant">Todavía no tienes tareas.</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Añade la primera con el botón +.</p>
          </div>
        )}
        {pending.map(renderTask)}
      </div>

      {done.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Completadas ({done.length})</h4>
          <div className="space-y-4 opacity-70">
            {done.map(renderTask)}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div onClick={() => !saving && setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative w-full max-w-lg bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-extrabold font-display text-on-surface">Nueva Tarea</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Título</label>
                  <input
                    type="text"
                    placeholder="Ej: Llamar a proveedor de Bata"
                    className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Prioridad</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewPriority(p.value)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          newPriority === p.value ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Nota (opcional)</label>
                  <textarea
                    placeholder="Detalles adicionales..."
                    rows={2}
                    className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={!newTitle.trim() || saving}
                onClick={handleAdd}
                className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                {saving ? <><Loader2 className="w-5 h-5 animate-spin" />Guardando...</> : 'Añadir Tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
