
import React, { useState, useEffect } from 'react';
import { User, DailyLog, TeamMember } from '../../types';
import { getLogs, saveLog, getLeaderboard } from '../../services/storageService';
import EarningsCalculator from '../Calculator';
import Dashboard from './Dashboard';
import EntryForm from './EntryForm';
import Chat from './Chat';
import { Gauge, PlusCircle, Calculator, CheckCircle, MessageCircle } from 'lucide-react';

interface TrackerProps {
  currentUser: User;
}

const Tracker: React.FC<TrackerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'calculator' | 'coach'>('dashboard');
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [notification, setNotification] = useState('');

  const isAdmin = currentUser.role === 'admin';

  const fetchData = async () => {
    const userLogsResult = await getLogs(currentUser.id);
    if (userLogsResult.success && userLogsResult.data) setLogs(userLogsResult.data);
    
    const leaderboardResult = await getLeaderboard(currentUser.id);
    if (leaderboardResult.success && leaderboardResult.data) setTeam(leaderboardResult.data);
  };

  useEffect(() => { fetchData(); }, [currentUser]);

  const handleSaveLog = async (newLog: DailyLog) => {
    setLogs(prev => [...prev, newLog]);
    const result = await saveLog(newLog);
    
    if (result.success) setNotification('🏁 Registro salvo!');
    else setNotification('❌ Erro: ' + result.error);
    
    setTimeout(() => setNotification(''), 3000);
    setActiveTab('dashboard');
    fetchData();
  };

  return (
    <div className="flex flex-col h-full w-full bg-race-dark">
      <div className="bg-race-navy sticky top-0 z-30 shadow-sm border-b border-white/10 px-4 pt-4">
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
           <TabButton active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} icon={<Gauge size={18} />} label="Painel" />
           <TabButton active={activeTab==='entry'} onClick={()=>setActiveTab('entry')} icon={<PlusCircle size={18} />} label="Registrar" />
           <TabButton active={activeTab==='calculator'} onClick={()=>setActiveTab('calculator')} icon={<Calculator size={18} />} label="Simulador" />
           <TabButton active={activeTab==='coach'} onClick={()=>setActiveTab('coach')} icon={<MessageCircle size={18} />} label="Coach" />
           
           {isAdmin && <span className="px-3 py-2 text-xs font-bold text-race-yellow bg-race-yellow/20 rounded border border-race-yellow/50 uppercase tracking-wider">Admin Mode</span>}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar w-full relative">
        <div className="max-w-4xl mx-auto space-y-6 h-full pb-20">
          {notification && (
            <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center font-bold fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
               <CheckCircle size={24} className="mr-3" /> {notification}
            </div>
          )}

          {activeTab === 'dashboard' && <Dashboard logs={logs} team={team} isAdmin={isAdmin} />}
          {activeTab === 'entry' && <EntryForm currentUser={currentUser} onSave={handleSaveLog} />}
          {activeTab === 'calculator' && <EarningsCalculator />}
          {activeTab === 'coach' && (
             <div className="h-[calc(100vh-160px)] min-h-[500px]">
                <Chat currentUser={currentUser} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${active ? 'bg-race-yellow text-race-dark shadow-lg' : 'text-gray-400 hover:bg-white/5'}`}>
    {icon} {label}
  </button>
);

export default Tracker;
