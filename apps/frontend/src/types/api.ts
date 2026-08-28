export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  emails: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SlackStatus {
  connected: boolean;
  connection: {
    id: string;
    teamId: string | null;
    channelId: string | null;
    createdAt: string;
  } | null;
}
