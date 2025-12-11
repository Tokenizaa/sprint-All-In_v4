
import { TeamMember, User } from '../types';

// In a real deployed app, this would point to your backend URL.
// For this environment, it assumes the server is serving /api routes.
const API_BASE = ''; 

export const syncExternalData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const adminKey = localStorage.getItem('admin_api_key');
    // We allow calls without key for demo, but server might reject
    const headers: any = { 'Content-Type': 'application/json' };
    if (adminKey) headers['x-admin-key'] = adminKey;

    const res = await fetch(`${API_BASE}/api/sync`, { method: 'POST', headers });
    return await res.json();
  } catch (e: any) {
    console.warn("Sync failed (likely offline or no server):", e);
    return { success: false, message: "Sync failed: " + e.message };
  }
};

export const getTeamPerformanceReport = async (): Promise<{ success: boolean; data?: TeamMember[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const getAllUsers = async (): Promise<{ success: boolean; data?: User[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const fetchUserStats = async (userId: string): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE}/api/stats?userId=${userId}`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        if (res.ok) return { success: true, message: "Connected to Server API" };
        return { success: false, message: "Server API returned error" };
    } catch (e: any) {
        return { success: false, message: "Offline or Server Unreachable" };
    }
};

export const updateUserRole = async (userId: string, newRole: string) => {
    return { success: false, error: "Role updates must be done via DB Admin console in this version." };
};
