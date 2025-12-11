
export type SlideLayout = 'cover' | 'standard' | 'columns' | 'conclusion';

export interface SlidePoint {
  title: string;
  description?: string;
  highlight?: boolean;
}

export interface SlideData {
  id: number;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  points: SlidePoint[];
  theme?: 'dark' | 'light';
}

export type Role = 'admin' | 'distributor';

export interface User {
  id: string;
  name: string;
  whatsapp: string;
  role: Role;
  createdAt: string;
}

export type LogType = 'presential' | 'online' | 'mixed';

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  pairsSold: number;
  prospectsContacted: number;
  activations: number;
  type: LogType;
}

export interface OfficialSale {
  id: string;
  distributorId: string;
  quantity: number;
  date: string;
  timestamp: number;
}

export interface TeamMember {
  id: string;
  name: string;
  totalOfficialSales: number;
  selfReportedSales: number;
  score: number;
  isCurrentUser: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
}

export interface QuickAction {
  label: string;
  question: string;
  answer: string;
}

// Chat message types
export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  isLocal?: boolean;
  timestamp?: number;
}

// External API Types
export interface ExternalDistributor {
  id: string;
  usuario: string;
  nome: string;
  email: string;
}

export interface ExternalOrder {
  id: string;
  cliente: string;
  telefone: string;
  situacao: string;
  total: string;
  itens: any[];
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface DataResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
