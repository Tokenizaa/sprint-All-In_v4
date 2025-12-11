
import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, CheckCircle, TrendingUp, RefreshCw, Loader2, Clock, AlertTriangle, UserCog, BarChart as BarChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TeamMember } from '../types';
import { getLeaderboard, getOfficialSalesHistory } from '../services/storageService';
import { validateQuantity } from '../utils/securityUtils';
import { getTeamPerformanceReport, updateUserRole, getAllUsers } from '../services/apiIntegrationService';


const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales'>('sales');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<{date: string, total: number}[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'distributor'>('distributor');
  const [notification, setNotification] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [externalApiLoading, setExternalApiLoading] = useState(false);
  const [externalApiResult, setExternalApiResult] = useState<string>('');
  const [lastImportedOrders, setLastImportedOrders] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [adminError, setAdminError] = useState<string>('');
  const [adminApiKey, setAdminApiKey] = useState<string>(localStorage.getItem('admin_api_key') || '');

  useEffect(() => {
    // Start regular refresh of data (admin sync must be executed server-side)
    refreshData();
    // Atualiza automaticamente a cada 30 minutos
    const interval = setInterval(refreshData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Note: initSupabaseAdmin must be executed on a secure server environment (cron/worker).
  // The front-end will not initialize the admin client to avoid leaking service role keys.

  const refreshData = async () => {
    setDataLoading(true);
    setUserLoading(true);
    setAdminError(''); // Clear previous errors
    
    // Sincronizar dados externos primeiro (via servidor)
    try {
      if (adminApiKey) {
        const resp = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey }
        });
        const syncResult = await resp.json();
        if (!syncResult.success) {
          console.warn("Aviso: Não foi possível sincronizar dados externos:", syncResult.message || syncResult.error);
        }
      } else {
        console.warn('Admin API key not set; skipping server-side sync');
      }
    } catch (error) {
      console.error("Erro ao sincronizar dados externos:", error);
    }
    
    // Depois buscar o leaderboard atualizado via servidor
    try {
      const resp = await fetch('/api/leaderboard');
      const reportResult = await resp.json();
      if (reportResult.success && reportResult.data) {
        setTeam(reportResult.data);
        setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } else {
        // Fallback para método local (client-side)
        const leaderboardResult = await getLeaderboard();
        if (leaderboardResult.success && leaderboardResult.data) {
          setTeam(leaderboardResult.data);
          setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } else if (leaderboardResult.error) {
          setAdminError(leaderboardResult.error);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar relatório de desempenho:", error);
      const leaderboardResult = await getLeaderboard();
      if (leaderboardResult.success && leaderboardResult.data) {
        setTeam(leaderboardResult.data);
        setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } else if (leaderboardResult.error) {
        setAdminError(leaderboardResult.error);
      }
    }

    // Fetch Global Sales History for Chart
    try {
        const historyRes = await getOfficialSalesHistory();
        if(historyRes.success && historyRes.data) {
            setSalesHistory(historyRes.data);
        }
    } catch(error) {
        console.error("Error fetching sales history", error);
    }
    
    // Buscar todos os usuários
    try {
      const usersResult = await getAllUsers();
      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      setUserLoading(false);
    }
    
    setDataLoading(false);
  };

  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setLoading(true);
    try {
      const result = await updateUserRole(selectedUser, newRole);
      if (result.success) {
        setNotification(`Papel do usuário atualizado para ${newRole} com sucesso!`);
        // Atualizar a lista de usuários
        await refreshData();
      } else {
        setNotification(`Erro ao atualizar papel do usuário: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      setNotification(`Erro ao atualizar papel do usuário: ${(error as Error).message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const handleTestExternalApi = async () => {
    setExternalApiLoading(true);
    setExternalApiResult('');
    
    try {
      if (!adminApiKey) {
        setExternalApiResult('Admin API key not set. Save your key to run server-side sync.');
        setExternalApiLoading(false);
        return;
      }

      const resp = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey }
      });
      const data = await resp.json();
      setExternalApiResult(data.message || data.error || JSON.stringify(data));

      // If payloads returned, extract orders and display
      if (data && Array.isArray(data.payloads)) {
        const pedidosPayload = data.payloads.find((p: any) => p.source === 'pedidos');
        if (pedidosPayload && Array.isArray(pedidosPayload.data)) {
          setLastImportedOrders(pedidosPayload.data.slice(0, 50)); // keep first 50 for display
        }
      }
    } catch (error) {
      setExternalApiResult(`Error: ${(error as Error).message}`);
    } finally {
      setExternalApiLoading(false);
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributor || !quantity) return;

    // Validate quantity
    const quantityValidation = validateQuantity(quantity);
    if (!quantityValidation.isValid) {
      setNotification(quantityValidation.message);
      setTimeout(() => setNotification(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const payload = { distributorId: selectedDistributor, quantity: Number(quantity) };
      const resp = await fetch('/api/official_sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminApiKey },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.success) {
        setNotification('Venda registrada com sucesso!');
        setQuantity('');
        await refreshData();
      } else {
        setNotification('Erro ao registrar venda: ' + (result.error || result.message || 'Erro desconhecido'));
      }
    } catch (e) {
      setNotification('Erro ao registrar venda: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
    
    setTimeout(() => setNotification(''), 3000);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* Header */}
      <div className="bg-race-navy text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative z-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-race-yellow opacity-10 rounded-bl-full -z-10"></div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Users className="text-race-yellow" />
            Painel do Administrador
          </h2>
          <p className="text-gray-400 mt-2">Gerencie as vendas oficiais e atualize o ranking.</p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock size={16} />
            <span>Atualizado às {lastUpdate}</span>
          </div>
        )}
      </div>
      
      {/* Admin Error Message */}
      {adminError && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex flex-col gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">Erro de Conexão Administrativa</p>
              <p className="text-sm mt-1">{adminError}</p>
              <p className="text-xs mt-2 text-red-300">Verifique as variáveis de ambiente e as credenciais do Supabase.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="text-xs text-yellow-200">Sincronização administrativa deve ser executada em ambiente servidor (cron/worker). Verifique SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.</div>
          </div>
        </div>
      )}

      {notification && (
        <div className="bg-green-600 text-white px-4 py-3 rounded-xl flex items-center justify-center font-bold animate-fade-in sticky top-4 z-50 shadow-lg">
          <CheckCircle size={20} className="mr-2" />
          {notification}
        </div>
      )}

      {/* Global Sales Chart */}
      <div className="bg-race-carbon border border-white/10 p-6 rounded-3xl shadow-xl">
        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <BarChartIcon className="text-race-yellow" />
            Performance da Rede (Vendas Oficiais - 7 Dias)
        </h3>
        <div className="w-full h-[300px]">
            {salesHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#0A0F1C', color: '#fff'}}
                            cursor={{fill: '#1a202c'}}
                        />
                        <Bar dataKey="total" fill="#00FF94" radius={[4, 4, 0, 0]} barSize={40} name="Vendas Oficiais" />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Sem dados de vendas recentes para exibir.
                </div>
            )}
        </div>
      </div>

      {/* ADMIN TABS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form: Test External API */}
        <div className="bg-race-carbon border border-white/10 p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <RefreshCw className="text-race-yellow" />
            Teste de API Externa
          </h3>
          
          <div className="space-y-5">
            <div className="bg-yellow-50/10 border border-yellow-400/20 p-4 rounded-xl">
              <p className="text-sm text-yellow-200">
                Esta seção testa a integração com a API externa da All-In Brasil.
                Ela obtém um token de acesso e busca dados de distribuidores e pedidos.
              </p>
            </div>
            
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Admin API Key"
                value={adminApiKey}
                onChange={(e) => { setAdminApiKey(e.target.value); localStorage.setItem('admin_api_key', e.target.value); }}
                className="flex-1 p-3 bg-black border border-white/10 rounded-xl focus:outline-none text-white"
              />
              <button
                onClick={handleTestExternalApi}
                disabled={externalApiLoading}
                className="px-4 bg-race-navy text-white font-bold py-3 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
              >
                {externalApiLoading ? <Loader2 className="animate-spin" /> : 'Sincronizar'}
              </button>
            </div>

            {externalApiResult && (
              <div className={`p-4 rounded-xl ${externalApiResult.startsWith('Error') ? 'bg-red-900/50 border border-red-500/50' : 'bg-green-900/50 border border-green-500/50'}`}>
                <p className={`font-medium ${externalApiResult.startsWith('Error') ? 'text-red-200' : 'text-green-200'}`}>
                  {externalApiResult}
                </p>
              </div>
            )}

            {lastImportedOrders.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold text-white mb-2">Pedidos importados (pré-visualização)</h4>
                <div className="max-h-48 overflow-y-auto bg-black/60 p-3 rounded-xl border border-white/10 text-sm">
                  {lastImportedOrders.map((o, idx) => (
                    <div key={o.id || idx} className="mb-2 pb-2 border-b border-white/5">
                      <div className="font-bold text-white">{o.cliente || '—'} <span className="text-xs text-gray-400">#{o.id}</span></div>
                      <div className="text-xs text-gray-300">Telefone: {o.telefone || '—'} — Patrocinador: {o.patrocinador ?? '—'}</div>
                      <div className="text-xs text-gray-300">Tipo: {o.tipo_cliente ?? '—'} — Situação: {o.situacao} — Total: {o.total ?? '—'}</div>
                      <div className="text-xs text-gray-300 mt-1">Produtos:</div>
                      <ul className="text-xs text-gray-400 ml-4">
                        {Array.isArray(o.itens) && o.itens.length ? o.itens.map((it: any, i: number) => (
                          <li key={i}>{it.produto || it.modelo || it.sku || 'Produto'} — Qtd: {it.quantidade} — SKU: {it.sku || '—'}</li>
                        )) : <li className="text-gray-500">Nenhum item listado</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Form: Add Sales */}
        <div className="bg-race-carbon border border-white/10 p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <PlusCircle className="text-race-yellow" />
            Apontar Venda (Oficial)
          </h3>
          
          <form onSubmit={handleAddSale} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Selecione o Distribuidor</label>
              <select
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className="w-full p-4 bg-black border border-white/10 rounded-xl focus:border-race-yellow focus:ring-2 focus:ring-race-yellow/20 focus:outline-none font-bold text-lg text-white"
                required
                disabled={dataLoading}
              >
                <option value="">-- Selecione --</option>
                {team.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} (Atual: {member.totalOfficialSales})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Quantidade de Pares</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-4 bg-black border border-white/10 rounded-xl focus:border-race-yellow focus:ring-2 focus:ring-race-yellow/20 focus:outline-none font-bold text-lg text-white"
                placeholder="Ex: 5"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || dataLoading}
              className="w-full bg-race-navy text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Atualizar Ranking'}
            </button>
          </form>
        </div>

        {/* Form: Update User Role */}
        <div className="bg-race-carbon border border-white/10 p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <UserCog className="text-race-yellow" />
            Gerenciar Papéis de Usuário
          </h3>
          
          <form onSubmit={handleUpdateUserRole} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Selecione o Usuário</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-4 bg-black border border-white/10 rounded-xl focus:border-race-yellow focus:ring-2 focus:ring-race-yellow/20 focus:outline-none font-bold text-lg text-white"
                required
                disabled={userLoading}
              >
                <option value="">-- Selecione --</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.whatsapp}) - {user.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Novo Papel</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'distributor')}
                className="w-full p-4 bg-black border border-white/10 rounded-xl focus:border-race-yellow focus:ring-2 focus:ring-race-yellow/20 focus:outline-none font-bold text-lg text-white"
                disabled={loading}
              >
                <option value="distributor">Distribuidor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || userLoading}
              className="w-full bg-race-navy text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Atualizar Papel'}
            </button>
          </form>
        </div>

        {/* List: Official Ranking */}
        <div className="bg-race-carbon border border-white/10 p-8 rounded-3xl shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
              <TrendingUp className="text-race-yellow" />
              Ranking Oficial
              </h3>
              <div className="flex gap-2">
                {lastUpdate && (
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {lastUpdate}
                  </div>
                )}
                <button 
                  onClick={refreshData} 
                  disabled={dataLoading}
                  className="text-xs font-bold text-race-navy bg-gray-100 hover:bg-race-yellow px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={dataLoading ? "animate-spin" : ""} />
                  Atualizar
                </button>
              </div>
          </div>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex-1">
            {team.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {dataLoading ? 'Carregando...' : 'Nenhum distribuidor encontrado.'}
                </div>
            ) : (
                team.map((member, index) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-4 rounded-2xl bg-black/50 border border-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm
                          ${index === 0 ? 'bg-race-yellow text-race-navy' : 'bg-white text-gray-500 border border-gray-200'}
                        `}>
                          {index + 1}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{member.name}</span>
                          <span className="text-xs text-gray-400">Auto-Reportado: <span className="text-gray-200">{member.selfReportedSales}</span></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-xl text-race-navy">{member.totalOfficialSales}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Confirmados</div>
                      </div>
                    </div>
                  ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
