
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TeamMember } from '../types';
import fetch from 'node-fetch';

// --- SERVER SIDE ONLY CONFIGURATION ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vzddnorrlkpkcsvvxity.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// External API Config
const API_BASE_URL = "https://allinbrasil.com.br/api/v1";
const CLIENT_ID = process.env.CLIENT_ID || "Camp_c20d65784a390c";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "62457f7a66c270904c63c1c02f929e64384383f4";

let supabaseAdmin: SupabaseClient | null = null;

export const initSupabaseAdmin = (): boolean => {
  if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY.includes('XXXXXXXX')) {
    console.error("Invalid Server Role Key");
    return false;
  }
  if (!supabaseAdmin) {
    try {
      supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    } catch (e) {
      console.error("Failed to init Supabase Admin:", e);
      return false;
    }
  }
  return true;
};

// --- EXTERNAL API HELPERS ---

async function getExternalToken(): Promise<string | null> {
  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');

    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    if (!response.ok) return null;
    const data: any = await response.json();
    return data.access_token;
  } catch (e) {
    console.error("Error getting token:", e);
    return null;
  }
}

// --- PUBLIC SERVER FUNCTIONS ---

export const syncExternalData = async (): Promise<{ success: boolean; message: string; payloads?: any[] }> => {
  if (!initSupabaseAdmin() || !supabaseAdmin) {
    return { success: false, message: "Server configuration error" };
  }

  try {
    const token = await getExternalToken();
    if (!token) return { success: false, message: "Failed to authenticate with External API" };

    // 1. Fetch Orders
    // Real implementation would fetch specific date range
    const ordersRes = await fetch(`${API_BASE_URL}/pedidos?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!ordersRes.ok) throw new Error("Failed to fetch orders");
    const ordersData: any = await ordersRes.json();
    const orders = ordersData.pedidos || [];

    // 2. Process Orders -> Official Sales
    let importedCount = 0;
    
    for (const order of orders) {
      if (order.pagamento_confirmado !== '1') continue;
      
      const phone = (order.cliente_telefone || '').replace(/\D/g, '');
      if (!phone) continue;

      // Find distributor by phone
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('whatsapp', phone)
        .limit(1);

      if (users && users.length > 0) {
        const userId = users[0].id;
        const qty = order.itens ? order.itens.length : 0; // Simplified logic

        if (qty > 0) {
          // Upsert sale
          const { error } = await supabaseAdmin.from('official_sales').upsert({
             distributor_id: userId,
             quantity: qty,
             date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
             timestamp: Date.now()
          }, { onConflict: 'distributor_id, date' }); // Assuming unique constraint

          if (!error) importedCount++;
        }
      }
    }

    return { 
      success: true, 
      message: `Synced ${importedCount} sales from ${orders.length} orders.`,
      payloads: [{ source: 'pedidos', count: orders.length }] 
    };

  } catch (e: any) {
    console.error("Sync Error:", e);
    return { success: false, message: e.message };
  }
};

export const getTeamPerformanceReport = async (): Promise<{ success: boolean; data?: TeamMember[]; error?: string }> => {
  if (!initSupabaseAdmin() || !supabaseAdmin) {
    // Return mock data if server not configured, to prevent app breakage during demo
    return { success: false, error: "Server DB not configured" };
  }

  try {
    const { data: users } = await supabaseAdmin.from('users').select('id, name, role').eq('role', 'distributor');
    const { data: sales } = await supabaseAdmin.from('official_sales').select('*');
    const { data: logs } = await supabaseAdmin.from('daily_logs').select('*');

    const members: TeamMember[] = (users || []).map(u => {
       const official = (sales || []).filter(s => s.distributor_id === u.id).reduce((acc, s) => acc + (s.quantity || 0), 0);
       const reported = (logs || []).filter(l => l.user_id === u.id).reduce((acc, l) => acc + (l.pairs_sold || 0), 0);
       
       return {
           id: u.id,
           name: u.name,
           totalOfficialSales: official,
           selfReportedSales: reported,
           score: official, // Ranking based on official sales
           isCurrentUser: false
       };
    });

    return { success: true, data: members.sort((a, b) => b.score - a.score) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const getUserStats = async (userId: string) => {
  if (!initSupabaseAdmin() || !supabaseAdmin) {
    return { success: false, error: "Server DB not configured" };
  }

  try {
    // Get Official Sales
    const { data: official } = await supabaseAdmin
      .from('official_sales')
      .select('quantity, date')
      .eq('distributor_id', userId);

    // Get Self Reported
    const { data: logs } = await supabaseAdmin
      .from('daily_logs')
      .select('pairs_sold, prospects_contacted, activations, date')
      .eq('user_id', userId);

    const totalOfficial = (official || []).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const totalReported = (logs || []).reduce((acc, curr) => acc + (curr.pairs_sold || 0), 0);
    const totalProspects = (logs || []).reduce((acc, curr) => acc + (curr.prospects_contacted || 0), 0);
    
    // Get Ranking Position
    const { data: allSales } = await supabaseAdmin.from('official_sales').select('distributor_id, quantity');
    const rankingMap = new Map<string, number>();
    
    allSales?.forEach(sale => {
      const current = rankingMap.get(sale.distributor_id) || 0;
      rankingMap.set(sale.distributor_id, current + sale.quantity);
    });

    const sortedIds = Array.from(rankingMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
    
    const rank = sortedIds.indexOf(userId) + 1;

    return {
      success: true,
      data: {
        totalOfficial,
        totalReported,
        totalProspects,
        rank: rank > 0 ? rank : 'N/A',
        history: official || []
      }
    };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const upsertOfficialSale = async (sale: any) => {
    if (!initSupabaseAdmin() || !supabaseAdmin) return { success: false, error: "DB not connected" };
    return await supabaseAdmin.from('official_sales').insert(sale).select();
};
