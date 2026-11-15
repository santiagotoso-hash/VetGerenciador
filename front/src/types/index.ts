// Tipos alinhados ao schema Prisma da API (back/prisma/schema.prisma)

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VETERINARIAN' | 'RECEPTIONIST' | 'GROOMER';

import type { Billing } from '@/lib/billing';

export interface Payment {
  id: string;
  amountCents: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  method: string;
  note?: string | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  active: boolean;
  createdAt: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  ownerDocument?: string | null;
  billing: Billing;
  invoice: { email: string | null; day: number | null; lastSentMonth: string | null; next: string | null; ready: boolean };
  lastPayment: { paidAt: string; amountCents: number } | null;
  activeUsers?: number;
  _count?: { users?: number; clients: number; pets: number; appointments: number };
  users?: { id?: string; name: string; email: string; role?: Role; active: boolean; phone?: string | null }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  active: boolean;
  companyId?: string | null;
  company?: { id: string; name: string; logo?: string | null; billing?: Billing | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  cpf?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  pets?: Pet[];
}

export type Species = 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'HAMSTER' | 'FISH' | 'REPTILE' | 'OTHER';

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string | null;
  color?: string | null;
  birthDate?: string | null;
  weight?: number | null;
  microchip?: string | null;
  photo?: string | null;
  birthdayEmail?: boolean;
  allergies?: string | null;
  observations?: string | null;
  active: boolean;
  clientId: string;
  client?: Client;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentType =
  | 'CONSULTATION'
  | 'VACCINATION'
  | 'EXAM'
  | 'SURGERY'
  | 'GROOMING'
  | 'BATH'
  | 'RETURN';

export interface Appointment {
  id: string;
  date: string;
  status: AppointmentStatus;
  type: AppointmentType;
  notes?: string | null;
  observations?: string | null;
  price?: number | null;
  notifyClient?: boolean;
  petId: string;
  pet?: Pet;
  veterinarianId?: string | null;
  scheduledBy?: Pick<User, 'id' | 'name'> | null;
  veterinarian?: Pick<User, 'id' | 'name'> | null;
  serviceId?: string | null;
  service?: Service | null;
}

export interface MedicalRecord {
  id: string;
  date: string;
  anamnesis?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  prescription?: string | null;
  exams?: string | null;
  weight?: number | null;
  temperature?: number | null;
  heartRate?: number | null;
  notes?: string | null;
  petId: string;
  pet?: Pet;
  veterinarianId: string;
  veterinarian?: Pick<User, 'id' | 'name'>;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  brand?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  costPrice?: number | null;
  stock: number;
  minStock: number;
  unit: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  price: number;
  duration: number;
  active: boolean;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BANK_TRANSFER' | 'CHECK';

export interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: Product | null;
  service?: Service | null;
}

export interface Sale {
  id: string;
  date: string;
  total: number;
  discount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  client?: Client | null;
  user?: Pick<User, 'id' | 'name'>;
  items: SaleItem[];
}

export type FinancialType = 'INCOME' | 'EXPENSE';

export interface FinancialEntry {
  id: string;
  type: FinancialType;
  description: string;
  amount: number;
  date: string;
  category: string;
  paymentMethod?: PaymentMethod | null;
  paid: boolean;
  notes?: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface DashboardStats {
  appointmentsToday: number;
  petsAttended: number;
  pendingAppointments: number;
  revenueToday: number;
  lowStockCount: number;
  upcomingAppointments: Appointment[];
}
