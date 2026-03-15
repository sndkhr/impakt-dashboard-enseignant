import { DashboardData, UserDetail } from '@/types';

const API_URL = 'https://europe-west1-impakt-6c00e.cloudfunctions.net/dashboardAPI';

export async function fetchDashboardData(token: string): Promise<DashboardData> {
  const response = await fetch(API_URL, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Erreur serveur: ${response.status}`);
  }

  return response.json();
}

export async function fetchUserDetail(token: string, uid: string): Promise<UserDetail> {
  const response = await fetch(`${API_URL}/user/${uid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Erreur serveur: ${response.status}`);
  }

  return response.json();
}

// ====== ÉCRITURE FIRESTORE ======

export interface ScheduleExchangePayload {
  beneficiaireUid: string;
  type: 'tel' | 'rdv';
  date: string;
  time: string;
  note?: string;
}

export async function scheduleExchange(token: string, payload: ScheduleExchangePayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const response = await fetch(`${API_URL}/exchange`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Erreur serveur: ${response.status} ${text}`);
  }

  return response.json();
}

export interface ValidateJobPayload {
  beneficiaireUid: string;
  jobName: string;
  jobIndex: number;
  validated: boolean;
}

export async function validateJob(token: string, payload: ValidateJobPayload): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/validate-job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Erreur serveur: ${response.status} ${text}`);
  }

  return response.json();
}
