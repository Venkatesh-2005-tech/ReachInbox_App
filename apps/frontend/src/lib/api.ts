import axios from 'axios';

import type {
  Email,
  ScheduleEmailPayload,
  ScheduleEmailResponse,
  Sender,
} from '@/types/email';

import type { User } from '@/types/auth';

import type {
  PaginatedResponse,
  SlackStatus,
} from '@/types/api';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://reachinbox-app-7w1w.onrender.com';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  getMe: () =>
    apiClient
      .get<User>('/auth/me')
      .then((r) => r.data),

  logout: () =>
    apiClient
      .post('/auth/logout')
      .then((r) => r.data),

  googleLoginUrl: () =>
    `${API_URL}/auth/google`,
};

// ── Senders ───────────────────────────────────────────────────────────────

export const sendersApi = {
  list: () =>
    apiClient
      .get<{ senders: Sender[] }>('/api/senders')
      .then((r) => r.data.senders),

  create: (email: string) =>
    apiClient
      .post<{ sender: Sender }>(
        '/api/senders',
        { email }
      )
      .then((r) => r.data.sender),

  delete: (id: string) =>
    apiClient
      .delete(`/api/senders/${id}`)
      .then((r) => r.data),
};

// ── Emails ────────────────────────────────────────────────────────────────

export const emailsApi = {
  schedule: (
    payload: ScheduleEmailPayload,
    attachments: File[] = []
  ) => {
    const formData = new FormData();

    formData.append(
      'senderId',
      payload.senderId
    );

    formData.append(
      'subject',
      payload.subject
    );

    formData.append(
      'body',
      payload.body
    );

    formData.append(
      'recipients',
      JSON.stringify(payload.recipients)
    );

    formData.append(
      'startTime',
      payload.startTime
    );

    formData.append(
      'delayBetweenEmails',
      String(payload.delayBetweenEmails)
    );

    formData.append(
      'hourlyLimit',
      String(payload.hourlyLimit)
    );

    attachments.forEach((file) => {
      formData.append(
        'attachments',
        file
      );
    });

    return apiClient
      .post<ScheduleEmailResponse>(
        '/api/emails/schedule',
        formData,
        {
          headers: {
            'Content-Type':
              'multipart/form-data',
          },
        }
      )
      .then((r) => r.data);
  },

  scheduled: (
    page = 1,
    limit = 20
  ) =>
    apiClient
      .get<PaginatedResponse<Email>>(
        '/api/emails/scheduled',
        {
          params: {
            page,
            limit,
          },
        }
      )
      .then((r) => r.data),

  sent: (
    page = 1,
    limit = 20
  ) =>
    apiClient
      .get<PaginatedResponse<Email>>(
        '/api/emails/sent',
        {
          params: {
            page,
            limit,
          },
        }
      )
      .then((r) => r.data),

  search: (
    q: string,
    page = 1,
    limit = 20
  ) =>
    apiClient
      .get<{
        hits: Email[];
        total: number;
      }>('/api/emails/search', {
        params: {
          q,
          page,
          limit,
        },
      })
      .then((r) => r.data),
};

// ── Slack ─────────────────────────────────────────────────────────────────

export const slackApi = {
  status: () =>
    apiClient
      .get<SlackStatus>('/api/slack/status')
      .then((r) => r.data),

  connectUrl: () =>
    `${API_URL}/api/slack/connect`,

  disconnect: () =>
    apiClient
      .delete('/api/slack/disconnect')
      .then((r) => r.data),
};