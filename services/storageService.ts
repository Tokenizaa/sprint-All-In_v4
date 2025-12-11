
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DailyLog, TeamMember, User, OfficialSale, AuthResponse, DataResponse, Task } from '../types';
import { sanitizeInput, validatePhoneNumber, validatePassword, validateName, hashPassword, verifyPassword } from '../utils/securityUtils';
import { handleError, ERROR_MESSAGES } from '../utils/errorUtils';

// Hardcoded configuration for production
const DEFAULT_PROJECT_URL = 'https://vzddnorrlkpkcsvvxity.supabase.co';

let supabase: SupabaseClient | null = null;

// Keys for LocalStorage Fallback (Mock DB)
const MOCK_USERS_KEY = 'sprint_mock_users';
const MOCK_LOGS_KEY = 'sprint_mock_logs';
const MOCK_SALES_KEY = 'sprint_mock_sales';
const MOCK_TASKS_KEY = 'sprint_mock_tasks';

// --- INITIALIZATION ---

export const initSupabase = () => {
  // Use environment variables if available, otherwise fall back to defaults
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || DEFAULT_PROJECT_URL;
  const supabaseKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  
  const storedKey = localStorage.getItem('sprint_supabase_key') || supabaseKey;
  
  // Basic validation to check if key is a placeholder or empty
  // Isso previne o erro "net::ERR_FAILED" e "Supabase not configured" repetitivo
  const isValidKey = storedKey && storedKey.length > 20 && !storedKey.includes('XXXXXXXX');

  if (supabaseUrl && isValidKey) {
    try {
      supabase = createClient(supabaseUrl, storedKey);
      console.log('✅ Supabase client initialized successfully');
    } catch (e) {
      console.error("Failed to init supabase client", e);
      supabase = null;
    }
  } else {
    // Fallback to offline mode seamlessly without alarming errors
    console.info('⚠️ Modo Offline Ativo: Supabase não configurado ou chave inválida.');
    supabase = null;
  }
};

// --- AUTHENTICATION ---

export const registerUser = async (name: string, whatsapp: string, password: string): Promise<AuthResponse> => {
  try {
    // Validate inputs
    const sanitizedPhone = sanitizeInput(whatsapp);
    const sanitizedName = sanitizeInput(name);
    
    if (!validatePhoneNumber(sanitizedPhone)) {
      return { success: false, error: "Número de telefone inválido" };
    }
    
    const nameValidation = validateName(sanitizedName);
    if (!nameValidation.isValid) {
      return { success: false, error: nameValidation.message };
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.message };
    }

    const cleanPhone = sanitizedPhone.replace(/\D/g, '');
    const cleanName = sanitizedName.trim();
    const createdAt = new Date().toISOString();

    // --- SUPABASE MODE ---
    if (supabase) {
      try {
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id')
          .eq('whatsapp', cleanPhone);

        if (existingUsers && existingUsers.length > 0) { 
          return { success: false, error: "Usuário já existe" };
        }

        // Hash password before storing (in a real app, use bcrypt or similar)
        const hashedPassword = hashPassword(password);

        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ name: cleanName, whatsapp: cleanPhone, password: hashedPassword, role: 'distributor' }])
          .select()
          .single();

        if (error) {
          return { success: false, error: "Erro ao registrar usuário" };
        }

        return {
          success: true,
          user: {
            id: newUser.id,
            name: newUser.name,
            whatsapp: newUser.whatsapp,
            role: newUser.role,
            createdAt: newUser.created_at
          }
        };
      } catch (err) {
        console.error("Supabase error", err);
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    } 
    
    // --- LOCAL MOCK MODE (Fallback) ---
    else {
      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
      
      // Check duplication
      if (storedUsers.some((u: User) => u.whatsapp === cleanPhone)) {
        return { success: false, error: "Usuário já existe" };
      }

      const newUser: User = {
        id: `local-${Date.now()}`,
        name: cleanName,
        whatsapp: cleanPhone,
        role: 'distributor', // Default role
        createdAt: createdAt
      };

      // Store password separately strictly for mock auth (in a real app, never store plain text passwords)
      const storedCreds = JSON.parse(localStorage.getItem(MOCK_USERS_KEY + '_creds') || '{}');
      storedCreds[cleanPhone] = hashPassword(password); // Hash password even in mock mode
      localStorage.setItem(MOCK_USERS_KEY + '_creds', JSON.stringify(storedCreds));

      storedUsers.push(newUser);
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(storedUsers));

      return { success: true, user: newUser };
    }
  } catch (error) {
    console.error("Unexpected error in registerUser", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

export const authenticateUser = async (identifier: string, password: string): Promise<AuthResponse> => {
  try {
    // Validate inputs
    const sanitizedIdentifier = sanitizeInput(identifier);
    
    if (!sanitizedIdentifier) {
      return { success: false, error: "Identificador inválido" };
    }
    
    if (!password) {
      return { success: false, error: "Senha inválida" };
    }

    // 1. Check Hardcoded Admin
    if (sanitizedIdentifier === 'Campanha1@allinbrasil.com.br' && password === 'All-in2025') {
        return {
            success: true,
            user: {
                id: 'admin-master',
                name: 'Administrador All-In',
                whatsapp: '00000000000',
                role: 'admin',
                createdAt: new Date().toISOString()
            }
        };
    }

    const cleanIdentifier = sanitizedIdentifier.includes('@') ? sanitizedIdentifier : sanitizedIdentifier.replace(/\D/g, '');

    // 2. Check Database (Supabase)
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('whatsapp', cleanIdentifier)
          .single();

        if (error || !data) {
          return { success: false, error: "Credenciais inválidas" };
        }

        // Verify password (in a real app, use bcrypt.compare or similar)
        if (!verifyPassword(password, data.password)) {
          return { success: false, error: "Credenciais inválidas" };
        }

        return {
            success: true,
            user: {
                id: data.id,
                name: data.name,
                whatsapp: data.whatsapp,
                role: data.role,
                createdAt: data.created_at
            }
        };
      } catch (err) {
        console.error("Auth error", err);
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    }

    // 3. Check Local Mock DB
    else {
      const storedCreds = JSON.parse(localStorage.getItem(MOCK_USERS_KEY + '_creds') || '{}');
      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');

      if (storedCreds[cleanIdentifier]) {
        // Verify password (in a real app, use bcrypt.compare or similar)
        if (verifyPassword(password, storedCreds[cleanIdentifier])) {
          const user = storedUsers.find((u: User) => u.whatsapp === cleanIdentifier);
          if (user) {
            return { success: true, user };
          }
        }
      }
      return { success: false, error: "Credenciais inválidas" };
    }
  } catch (error) {
    console.error("Unexpected error in authenticateUser", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

// --- LOGS (SELF REPORTING) ---

export const getLogs = async (userId: string): Promise<DataResponse<DailyLog[]>> => {
  try {
    if (supabase) {
      try {
        // Ensuring sort by date for charts
        const dailyLogsResult = await supabase
            .from('daily_logs')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: true }); // Ensure chronological order

        const { data, error } = dailyLogsResult;
        if (error) {
          return { success: false, error: "Erro ao buscar registros" };
        }
        // Garantir que data seja um array antes de mapear
        const logsData = Array.isArray(data) ? data : [];
        return {
          success: true,
          data: logsData.map((d: any) => ({
            id: d.id, userId: d.user_id, date: d.date, pairsSold: d.pairs_sold, prospectsContacted: d.prospects_contacted, activations: d.activations, type: d.type
          }))
        };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    } else {
      // Mock
      try {
        const allLogs = JSON.parse(localStorage.getItem(MOCK_LOGS_KEY) || '[]');
        // Garantir que allLogs seja um array
        const logsArray = Array.isArray(allLogs) ? allLogs : [];
        // Sort local logs by timestamp/date implicitly if pushed in order, but safe to sort if needed
        return {
          success: true,
          data: logsArray.filter((l: DailyLog) => l.userId === userId)
        };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.UNKNOWN_ERROR);
        return { success: false, error: errorMessage };
      }
    }
  } catch (error) {
    console.error("Unexpected error in getLogs", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

export const saveLog = async (log: DailyLog): Promise<DataResponse<void>> => {
  try {
    // Validate inputs
    if (!log.userId) {
      return { success: false, error: "ID do usuário inválido" };
    }
    
    if (log.pairsSold < 0 || log.pairsSold > 100) {
      return { success: false, error: "Número de pares vendidos inválido" };
    }
    
    if (log.prospectsContacted < 0 || log.prospectsContacted > 1000) {
      return { success: false, error: "Número de prospects inválido" };
    }
    
    if (log.activations < 0 || log.activations > 100) {
      return { success: false, error: "Número de ativações inválido" };
    }
    
    if (!log.date) {
      return { success: false, error: "Data inválida" };
    }

    if (supabase) {
      try {
        const dailyLogsInsertResult = await supabase.from('daily_logs').insert([{
            user_id: log.userId, date: log.date, pairs_sold: log.pairsSold, prospects_contacted: log.prospectsContacted, activations: log.activations, type: log.type
        }]);
        const { error } = dailyLogsInsertResult;
        if (error) {
          return { success: false, error: "Erro ao salvar registro" };
        }
        return { success: true };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    } else {
      // Mock
      try {
        const allLogs = JSON.parse(localStorage.getItem(MOCK_LOGS_KEY) || '[]');
        allLogs.push(log);
        localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(allLogs));
        return { success: true };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.UNKNOWN_ERROR);
        return { success: false, error: errorMessage };
      }
    }
  } catch (error) {
    console.error("Unexpected error in saveLog", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

// --- OFFICIAL SALES (ADMIN ONLY) ---

export const addOfficialSale = async (distributorId: string, quantity: number): Promise<DataResponse<void>> => {
  try {
    // Validate inputs
    if (!distributorId) {
      return { success: false, error: "ID do distribuidor inválido" };
    }
    
    if (quantity <= 0 || quantity > 1000) {
      return { success: false, error: "Quantidade inválida" };
    }

    if (supabase) {
      try {
        const officialSalesInsertResult = await supabase.from('official_sales').insert([{
            distributor_id: distributorId, quantity: quantity, date: new Date().toISOString().split('T')[0], timestamp: Date.now()
        }]);
        const { error } = officialSalesInsertResult;
        if (error) {
          return { success: false, error: "Erro ao registrar venda" };
        }
        return { success: true };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    } else {
      // Mock
      try {
        const allSales = JSON.parse(localStorage.getItem(MOCK_SALES_KEY) || '[]');
        allSales.push({
          id: `sale-${Date.now()}`,
          distributorId,
          quantity,
          date: new Date().toISOString().split('T')[0],
          timestamp: Date.now()
        });
        localStorage.setItem(MOCK_SALES_KEY, JSON.stringify(allSales));
        return { success: true };
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.UNKNOWN_ERROR);
        return { success: false, error: errorMessage };
      }
    }
  } catch (error) {
    console.error("Unexpected error in addOfficialSale", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

// Aggregates sales for Admin Chart
export const getOfficialSalesHistory = async (): Promise<DataResponse<{date: string, total: number}[]>> => {
  try {
    let allSales: any[] = [];
    if (supabase) {
       const { data, error } = await supabase.from('official_sales').select('*').gte('timestamp', Date.now() - 7 * 24 * 60 * 60 * 1000);
       if (error) return { success: false, error: error.message };
       allSales = data || [];
    } else {
       allSales = JSON.parse(localStorage.getItem(MOCK_SALES_KEY) || '[]');
    }

    // Aggregate by date
    const historyMap = new Map<string, number>();
    
    // Fill last 7 days with 0
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        // Format as DD/MM for display
        const displayDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
        historyMap.set(displayDate, 0);
    }

    allSales.forEach(sale => {
       const d = new Date(sale.date || sale.timestamp);
       const displayDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
       if (historyMap.has(displayDate)) {
           historyMap.set(displayDate, historyMap.get(displayDate)! + Number(sale.quantity));
       }
    });

    const result = Array.from(historyMap.entries()).map(([date, total]) => ({ date, total }));
    return { success: true, data: result };

  } catch (err) {
    return { success: false, error: handleError(err) };
  }
}

// --- LEADERBOARD / TEAM STATS ---

export const getLeaderboard = async (currentUserId?: string): Promise<DataResponse<TeamMember[]>> => {
  try {
    let users: any[] = [];
    let allSales: any[] = [];
    let allLogs: any[] = [];

    if (supabase) {
      try {
        const userResult = await supabase.from('users').select('*').eq('role', 'distributor');
        const salesResult = await supabase.from('official_sales').select('*');
        const logsResult = await supabase.from('daily_logs').select('*');
        
        const { data: u, error: userError } = userResult;
        const { data: s, error: salesError } = salesResult;
        const { data: l, error: logsError } = logsResult;
        
        if (userError || salesError || logsError) {
          return { success: false, error: "Erro ao buscar dados do ranking" };
        }
        
        // Garantir que os dados sejam arrays
        users = Array.isArray(u) ? u : [];
        allSales = Array.isArray(s) ? s : [];
        allLogs = Array.isArray(l) ? l : [];
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.SERVER_ERROR);
        return { success: false, error: errorMessage };
      }
    } else {
      // Mock
      try {
        const storedUsers = localStorage.getItem(MOCK_USERS_KEY) || '[]';
        const storedSales = localStorage.getItem(MOCK_SALES_KEY) || '[]';
        const storedLogs = localStorage.getItem(MOCK_LOGS_KEY) || '[]';
        
        // Garantir que os dados sejam arrays válidos
        users = Array.isArray(JSON.parse(storedUsers)) ? JSON.parse(storedUsers).filter((u: any) => u.role === 'distributor') : [];
        allSales = Array.isArray(JSON.parse(storedSales)) ? JSON.parse(storedSales) : [];
        allLogs = Array.isArray(JSON.parse(storedLogs)) ? JSON.parse(storedLogs) : [];
      } catch (err) {
        const errorMessage = handleError(err, ERROR_MESSAGES.UNKNOWN_ERROR);
        return { success: false, error: errorMessage };
      }
    }

    // Calculate Stats
    try {
      const leaderboard: TeamMember[] = users.map((user: any) => {
        // Official Sales (Mock structure uses camelCase, Supabase uses snake_case, need to handle both if switching)
        const userOfficialSales = allSales
          .filter((s: any) => (s.distributor_id === user.id || s.distributorId === user.id))
          .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);

        // Self Reported Sales
        const userReportedSales = allLogs
          .filter((l: any) => (l.user_id === user.id || l.userId === user.id))
          .reduce((acc: number, curr: any) => acc + (curr.pairs_sold || curr.pairsSold || 0), 0);

        return {
          id: user.id,
          name: user.name,
          totalOfficialSales: userOfficialSales,
          selfReportedSales: userReportedSales,
          score: userOfficialSales, 
          isCurrentUser: user.id === currentUserId
        };
      });

      return {
        success: true,
        data: leaderboard.sort((a, b) => b.score - a.score)
      };
    } catch (err) {
      const errorMessage = handleError(err, "Erro ao calcular ranking");
      return { success: false, error: errorMessage };
    }
  } catch (error) {
    console.error("Unexpected error in getLeaderboard", error);
    const errorMessage = handleError(error, ERROR_MESSAGES.UNKNOWN_ERROR);
    return { success: false, error: errorMessage };
  }
};

// --- TASKS ---

export const getTasks = async (userId: string): Promise<Task[]> => {
  if (supabase) {
     const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
     if (error) return [];
     return data.map((t: any) => ({
       id: t.id, userId: t.user_id, title: t.title, description: t.description, completed: t.completed, createdAt: t.created_at
     }));
  } else {
    const all = JSON.parse(localStorage.getItem(MOCK_TASKS_KEY) || '[]');
    return all.filter((t: Task) => t.userId === userId);
  }
};

export const addTask = async (task: Task): Promise<void> => {
   if (supabase) {
     await supabase.from('tasks').insert([{
       user_id: task.userId, title: task.title, description: task.description, completed: task.completed, created_at: task.createdAt
     }]);
   } else {
     const all = JSON.parse(localStorage.getItem(MOCK_TASKS_KEY) || '[]');
     all.push(task);
     localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(all));
   }
};

export const toggleTask = async (taskId: string, completed: boolean): Promise<void> => {
  if (supabase) {
    await supabase.from('tasks').update({ completed }).eq('id', taskId);
  } else {
    const all = JSON.parse(localStorage.getItem(MOCK_TASKS_KEY) || '[]');
    const idx = all.findIndex((t: Task) => t.id === taskId);
    if (idx >= 0) {
      all[idx].completed = completed;
      localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(all));
    }
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  if (supabase) {
    await supabase.from('tasks').delete().eq('id', taskId);
  } else {
     const all = JSON.parse(localStorage.getItem(MOCK_TASKS_KEY) || '[]');
     const filtered = all.filter((t: Task) => t.id !== taskId);
     localStorage.setItem(MOCK_TASKS_KEY, JSON.stringify(filtered));
  }
};
