<script lang="ts">
  import type { ToastItem } from '../types';

  interface Props {
    toasts: ToastItem[];
  }

  let { toasts }: Props = $props();
</script>

<div class="toast-container">
  {#each toasts as t (t.id)}
    <div class="toast">
      {t.text}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }

  .toast {
    padding: 12px 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    animation: toastIn 240ms cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }

  @keyframes toastIn {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
