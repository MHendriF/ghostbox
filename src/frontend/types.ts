export interface Inbox {
  address: string;
  created_at?: string;
}

export interface Message {
  id: string;
  message_id?: string | null;
  from_address: string;
  inbox_address: string;
  subject: string;
  body: string;
  received_at: string;
}

export interface AppConfig {
  appName: string;
  mailDomain: string;
  mailDomains?: string[];
  webHost: string;
  authRequired?: boolean;
  usernameRequired?: boolean;
  autoRefreshMs?: number;
}

export interface ToastItem {
  id: string;
  text: string;
}
