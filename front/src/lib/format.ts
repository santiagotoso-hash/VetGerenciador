import type { AppointmentStatus, AppointmentType, Species } from '@/types';

export const currency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const speciesLabel: Record<Species, string> = {
  DOG: 'Cachorro',
  CAT: 'Gato',
  BIRD: 'Ave',
  RABBIT: 'Coelho',
  HAMSTER: 'Hamster',
  FISH: 'Peixe',
  REPTILE: 'Réptil',
  OTHER: 'Outro',
};

export const speciesIcon: Record<Species, string> = {
  DOG: '🐶',
  CAT: '🐱',
  BIRD: '🐦',
  RABBIT: '🐰',
  HAMSTER: '🐹',
  FISH: '🐟',
  REPTILE: '🦎',
  OTHER: '🐾',
};

export const statusLabel: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

export const statusColor: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-100 text-red-700',
};

export const typeLabel: Record<AppointmentType, string> = {
  CONSULTATION: 'Consulta',
  VACCINATION: 'Vacinação',
  EXAM: 'Exame',
  SURGERY: 'Cirurgia',
  GROOMING: 'Tosa',
  BATH: 'Banho',
  RETURN: 'Retorno',
};

/** datetime-local value (yyyy-MM-ddTHH:mm) no fuso local */
export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
