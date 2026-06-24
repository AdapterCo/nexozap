export enum AIProvider {
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Plan {
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum WhatsAppStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum ConversationMode {
  AI = 'AI',
  FLOW = 'FLOW',
  HUMAN = 'HUMAN',
}

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  WAITING = 'WAITING',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageSender {
  CLIENT = 'CLIENT',
  BOT = 'BOT',
  HUMAN = 'HUMAN',
}

export enum ReminderType {
  HOURS_24 = 'HOURS_24',
  HOURS_2 = 'HOURS_2',
  AFTER_SERVICE = 'AFTER_SERVICE',
}

export enum FlowNodeType {
  MESSAGE = 'MESSAGE',
  MENU = 'MENU',
  QUESTION = 'QUESTION',
  CONDITION = 'CONDITION',
  SCHEDULING = 'SCHEDULING',
  TRANSFER = 'TRANSFER',
  END = 'END',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  ownerName: string;
  whatsapp: string;
  email: string;
  address?: string;
  openingTime: string;
  closingTime: string;
  workingDays: string[];
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Professional {
  id: string;
  companyId: string;
  name: string;
  photo?: string;
  specialty?: string;
  workingHours: Record<string, { start: string; end: string }>;
  availableDays: string[];
  isActive: boolean;
  services?: Service[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  companyId: string;
  serviceId: string;
  professionalId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  service?: Service;
  professional?: Professional;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
}

export interface Flow {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  isActive: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  companyId: string;
  whatsappConnectionId: string;
  clientPhone: string;
  clientName?: string;
  mode: ConversationMode;
  status: ConversationStatus;
  startedAt: Date;
  endedAt?: Date;
  tokenUsage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  direction: MessageDirection;
  sender: MessageSender;
  createdAt: Date;
}

export interface AIConfig {
  id: string;
  companyId: string;
  provider: AIProvider;
  model: string;
  apiKey?: string;
  personality?: string;
  toneOfVoice?: string;
  rules: string[];
  faq: { question: string; answer: string }[];
  isActive: boolean;
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
  allowedHoursStart: string;
  allowedHoursEnd: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evaluation {
  id: string;
  appointmentId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalAppointments: number;
  todayAppointments: number;
  activeConversations: number;
  conversionRate: number;
  totalRevenue: number;
  completedAppointments: number;
  cancelledAppointments: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  companyName: string;
}

export interface CreateAppointmentDto {
  serviceId: string;
  professionalId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  date: string;
  startTime: string;
  notes?: string;
}

export interface CreateServiceDto {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color: string;
}

export interface CreateProfessionalDto {
  name: string;
  photo?: string;
  specialty?: string;
  workingHours: Record<string, { start: string; end: string }>;
  availableDays: string[];
  serviceIds?: string[];
}

export interface CreateFlowDto {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface UpdateFlowDto extends Partial<CreateFlowDto> {
  isActive?: boolean;
}
