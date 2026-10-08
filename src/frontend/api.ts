import type { AppConfig, Inbox, Message } from './types';

export const SESSION_KEY = 'ghostbox_session_id';
export const USERNAME_KEY = 'ghostbox_auth_user';
export const PASSCODE_KEY = 'ghostbox_auth_passcode';

export interface ApiClientOptions {
  onUnauthorized?: () => void;
}

export class ApiClient {
  sessionId = '';
  authUsername = '';
  authPasscode = '';
  onUnauthorized?: () => void;

  constructor(options: ApiClientOptions = {}) {
    this.sessionId = localStorage.getItem(SESSION_KEY) || localStorage.getItem('tempik_session_id') || '';
    this.authUsername = localStorage.getItem(USERNAME_KEY) || '';
    this.authPasscode = localStorage.getItem(PASSCODE_KEY) || '';
    this.onUnauthorized = options.onUnauthorized;
  }

  setSession(id: string) {
    this.sessionId = id;
    if (id) {
      localStorage.setItem(SESSION_KEY, id);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  setAuth(user: string, pass: string) {
    this.authUsername = user;
    this.authPasscode = pass;
    if (user) {
      localStorage.setItem(USERNAME_KEY, user);
    } else {
      localStorage.removeItem(USERNAME_KEY);
    }
    if (pass) {
      localStorage.setItem(PASSCODE_KEY, pass);
    } else {
      localStorage.removeItem(PASSCODE_KEY);
    }
  }

  clearAuth() {
    this.setAuth('', '');
  }

  async fetchJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.sessionId) {
      headers['x-session-id'] = this.sessionId;
    }
    if (this.authUsername) {
      headers['x-auth-username'] = this.authUsername;
    }
    if (this.authPasscode) {
      headers['x-auth-passcode'] = this.authPasscode;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401 && this.onUnauthorized) {
        this.clearAuth();
        this.onUnauthorized();
      }
      let errMsg = '';
      try {
        const errObj = (await res.json()) as any;
        errMsg = errObj?.error || JSON.stringify(errObj);
      } catch {
        errMsg = await res.text();
      }
      throw new Error(errMsg || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async getConfig(): Promise<AppConfig> {
    return this.fetchJson<AppConfig>('/api/config');
  }

  async ensureSession(): Promise<string> {
    const data = await this.fetchJson<{ sessionId: string }>('/api/session');
    this.setSession(data.sessionId);
    return data.sessionId;
  }

  async getInboxes(): Promise<Inbox[]> {
    return this.fetchJson<Inbox[]>('/api/inboxes');
  }

  async createInbox(localPart?: string, domain?: string): Promise<Inbox> {
    return this.fetchJson<Inbox>('/api/inboxes', {
      method: 'POST',
      body: JSON.stringify({ localPart, domain }),
    });
  }

  async deleteInbox(address: string): Promise<void> {
    await this.fetchJson(`/api/inboxes/${encodeURIComponent(address)}`, {
      method: 'DELETE',
    });
  }

  async getMessages(address: string): Promise<Message[]> {
    return this.fetchJson<Message[]>(`/api/inboxes/${encodeURIComponent(address)}/messages`);
  }

  async deleteMessage(address: string, messageId: string): Promise<void> {
    await this.fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
  }

  async verifyPasscode(username: string, passcode: string): Promise<boolean> {
    const res = await fetch('/api/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passcode }),
    });
    return res.ok;
  }
}
