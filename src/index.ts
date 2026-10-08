import api from './api/routes';
import { handleEmail } from './email-handler';
import type { EmailHandlerEnv } from './email-handler';
import type { ApiEnv } from './api/routes';
import { cleanupExpiredMessages, cleanupOrphanInboxes } from './db/queries';

/**
 * GhostBox - Disposable Temp Mail on Cloudflare Workers
 *
 * Handles:
 * - fetch()     → API routes (static files served via Cloudflare Assets)
 * - email()     → inbound email processing via Cloudflare Email Worker
 * - scheduled() → periodic retention cleanup of expired messages and orphan inboxes
 */

// Combined env bindings with configurable retention
export interface Env extends ApiEnv, EmailHandlerEnv {
  RETENTION_HOURS?: string;
}

export default {
  /**
   * HTTP fetch handler - serves API routes.
   * Static files (src/web/) are served via Cloudflare [assets].
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route /api/* to Hono router (strip /api prefix)
    if (url.pathname.startsWith('/api/')) {
      const apiUrl = new URL(request.url);
      apiUrl.pathname = url.pathname.slice(4); // strip '/api'
      const apiRequest = new Request(apiUrl, request);
      return api.fetch(apiRequest, env, ctx);
    }

    // Fallback: should not happen when [assets] is configured properly
    return new Response('Not found', { status: 404 });
  },

  /**
   * Email handler - called by Cloudflare for every inbound email
   * at any @<MAIL_DOMAIN> address.
   */
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleEmail(message, env);
  },

  /**
   * Scheduled handler - periodic data retention and cleanup job
   */
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const retentionHours = parseInt(env.RETENTION_HOURS || '24', 10) || 24;

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'cron_retention_start',
        retentionHours,
        scheduledTime: event.scheduledTime,
      })
    );

    try {
      const deletedMessages = await cleanupExpiredMessages(env.DB, retentionHours);
      const deletedInboxes = await cleanupOrphanInboxes(env.DB, retentionHours);
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'cron_retention_complete',
          retentionHours,
          purgedMessages: deletedMessages,
          purgedInboxes: deletedInboxes,
        })
      );
    } catch (err: any) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'cron_retention_failed',
          error: err?.message || String(err),
        })
      );
    }
  },
};
