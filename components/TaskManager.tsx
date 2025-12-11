
import React, { useState, useEffect } from 'react';
import { PlusCircle, CheckCircle, Trash2, ListTodo, Circle } from 'lucide-react';
import { Task } from '../types';
import { getTasks, addTask, toggleTask, deleteTask } from '../services/storageService';

interface TaskManagerProps {
  userId: string;
}

const TaskManager: React.FC<TaskManagerProps> = ({ userId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadTasks();
  }, [userId]);

  const loadTasks = async () => {
    const data = await getTasks(userId);
    setTasks(data);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      userId,
      title,
      description,
      completed: false,
      createdAt: new Date().toISOString()
    };

    setTasks(prev => [newTask, ...prev]);
    setTitle('');
    setDescription('');
    await addTask(newTask);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    await toggleTask(id, !currentStatus);
  };

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await deleteTask(id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Form */}
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-2 bg-race-green"></div>
         <h2 className="text-2xl font-black text-race-navy mb-2 flex items-center gap-2 uppercase italic tracking-tight">
            <ListTodo className="text-race-green" /> Minhas Missões
         </h2>
         <p className="text-gray-500 text-sm mb-6 font-medium">Defina suas micro-metas diárias para o sprint.</p>
         
         <form onSubmit={handleAdd} className="space-y-4">
            <div>
               <input 
                 type="text" 
                 value={title} 
                 onChange={e => setTitle(e.target.value)} 
                 className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-race-green focus:bg-white transition-all font-bold text-lg outline-none text-race-navy placeholder-gray-400" 
                 placeholder="Título da Tarefa (Ex: Visitar 3 clientes)" 
                 required 
               />
            </div>
            <div>
               <textarea 
                 value={description} 
                 onChange={e => setDescription(e.target.value)} 
                 className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-race-green focus:bg-white transition-all font-medium text-base outline-none text-race-navy placeholder-gray-400 min-h-[100px]" 
                 placeholder="Descrição ou detalhes adicionais..." 
               />
            </div>

            <button type="submit" className="w-full py-4 bg-race-navy text-white font-black text-lg uppercase italic tracking-widest rounded-xl hover:scale-[1.01] active:scale-95 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              <PlusCircle size={20} /> Adicionar Missão
            </button>
         </form>
      </div>

      {/* List */}
      <div className="space-y-3">
        {tasks.length === 0 && (
            <div className="text-center py-10 text-gray-400 font-medium">
                Nenhuma tarefa pendente. Acelere!
            </div>
        )}
        {tasks.map(task => (
            <div key={task.id} className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all ${task.completed ? 'bg-gray-100 border-gray-200 opacity-70' : 'bg-white border-gray-100 shadow-sm hover:border-race-green/30'}`}>
                <button 
                  onClick={() => handleToggle(task.id, task.completed)}
                  className={`mt-1 flex-shrink-0 transition-colors ${task.completed ? 'text-race-green' : 'text-gray-300 hover:text-race-green'}`}
                >
                    {task.completed ? <CheckCircle size={24} fill="currentColor" className="text-white" /> : <Circle size={24} />}
                </button>
                
                <div className="flex-1">
                    <h3 className={`font-bold text-lg leading-tight mb-1 ${task.completed ? 'line-through text-gray-500' : 'text-race-navy'}`}>
                        {task.title}
                    </h3>
                    {task.description && (
                        <p className={`text-sm leading-relaxed ${task.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {task.description}
                        </p>
                    )}
                </div>

                <button 
                    onClick={() => handleDelete(task.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-2"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default TaskManager;