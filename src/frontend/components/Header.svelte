<script lang="ts">
  interface Props {
    appName: string;
    appSubtitle: string;
  }

  let { appName, appSubtitle }: Props = $props();
</script>

<header>
  <div class="brand">
    <div class="brand-icon">
      <svg class="brand-logo-svg" viewBox="0 0 512 512" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hdrBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#121624" />
            <stop offset="100%" stop-color="#0a0c14" />
          </linearGradient>
          <linearGradient id="hdrBorder" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#818cf8" />
            <stop offset="45%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
          <linearGradient id="hdrGhost" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#818cf8" />
            <stop offset="60%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#0ea5e9" />
          </linearGradient>
          <linearGradient id="hdrFold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#c7d2fe" />
          </linearGradient>
        </defs>
        <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#hdrBg)" stroke="url(#hdrBorder)" stroke-width="12" />
        <path d="M152 216C152 158.56 198.56 112 256 112C313.44 112 360 158.56 360 216V368C360 380 345.6 388 335.5 380.2L302.2 354.5L256 388L209.8 354.5L176.5 380.2C166.4 388 152 380 152 368V216Z" fill="url(#hdrGhost)" />
        <path d="M168 216L256 288L344 216" stroke="url(#hdrFold)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="216" cy="200" r="18" fill="#ffffff" />
        <circle cx="296" cy="200" r="18" fill="#ffffff" />
        <circle cx="220" cy="198" r="7" fill="#4f46e5" />
        <circle cx="300" cy="198" r="7" fill="#4f46e5" />
        <circle cx="256" cy="336" r="8" fill="#38bdf8" />
      </svg>
    </div>
    <h1>{appName}</h1>
  </div>
  <p>{appSubtitle}</p>
</header>

<style>
  header {
    text-align: center;
    margin-bottom: 32px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .brand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(18, 22, 34, 0.7);
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25), 0 0 20px rgba(6, 182, 212, 0.15);
    transition: var(--transition);
  }

  .brand-icon:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4), 0 0 28px rgba(6, 182, 212, 0.25);
    border-color: rgba(99, 102, 241, 0.6);
  }

  .brand-logo-svg {
    display: block;
  }

  h1 {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 50%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  p {
    font-size: 14px;
    color: var(--text-muted);
  }
</style>
