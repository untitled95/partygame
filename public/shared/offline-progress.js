(function registerOfflineCacheWithProgress() {
  if (!('serviceWorker' in navigator)) return;

  const state = {
    visible: false,
    hideTimer: null,
    elements: null
  };

  function ensureStyles() {
    if (document.getElementById('offline-progress-styles')) return;

    const style = document.createElement('style');
    style.id = 'offline-progress-styles';
    style.textContent = `
      .offline-progress {
        position: fixed;
        left: 50%;
        bottom: 18px;
        z-index: 1000;
        width: min(420px, calc(100vw - 28px));
        padding: 14px 16px;
        border: 1px solid rgba(255, 255, 255, 0.74);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: 0 18px 45px rgba(101, 76, 125, 0.18);
        color: #2f243a;
        backdrop-filter: blur(18px);
        transform: translate(-50%, 24px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
      }

      .offline-progress.show {
        transform: translate(-50%, 0);
        opacity: 1;
      }

      .offline-progress-title {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 0.92rem;
        font-weight: 800;
      }

      .offline-progress-percent {
        color: #7c3aed;
        white-space: nowrap;
      }

      .offline-progress-track {
        height: 9px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(124, 58, 237, 0.12);
      }

      .offline-progress-bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ff6b6b, #f97316, #10b981);
        transition: width 0.18s ease;
      }

      .offline-progress-detail {
        margin-top: 8px;
        color: #746a82;
        font-size: 0.78rem;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureElements() {
    if (state.elements) return state.elements;

    ensureStyles();
    const wrapper = document.createElement('div');
    wrapper.className = 'offline-progress';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.innerHTML = `
      <div class="offline-progress-title">
        <span class="offline-progress-text">正在准备离线模式</span>
        <span class="offline-progress-percent">0%</span>
      </div>
      <div class="offline-progress-track">
        <div class="offline-progress-bar"></div>
      </div>
      <div class="offline-progress-detail">首次加载会缓存单人小游戏，之后断网也能玩。</div>
    `;
    document.body.appendChild(wrapper);

    state.elements = {
      wrapper,
      text: wrapper.querySelector('.offline-progress-text'),
      percent: wrapper.querySelector('.offline-progress-percent'),
      bar: wrapper.querySelector('.offline-progress-bar'),
      detail: wrapper.querySelector('.offline-progress-detail')
    };
    return state.elements;
  }

  function showProgress() {
    clearTimeout(state.hideTimer);
    const { wrapper } = ensureElements();
    state.visible = true;
    requestAnimationFrame(() => wrapper.classList.add('show'));
  }

  function hideProgress(delay = 1200) {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      if (!state.elements) return;
      state.elements.wrapper.classList.remove('show');
      state.visible = false;
    }, delay);
  }

  function setProgress({ percent, text, detail }) {
    const elements = ensureElements();
    const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
    elements.bar.style.width = `${safePercent}%`;
    elements.percent.textContent = `${safePercent}%`;
    if (text) elements.text.textContent = text;
    if (detail) elements.detail.textContent = detail;
    showProgress();
  }

  navigator.serviceWorker.addEventListener('message', event => {
    const data = event.data || {};
    if (data.source !== 'partygame-sw') return;

    if (data.type === 'offline-cache-start') {
      setProgress({
        percent: 2,
        text: '正在加载离线模式',
        detail: `准备缓存 ${data.total || 0} 个单人游戏资源。`
      });
      return;
    }

    if (data.type === 'offline-cache-progress') {
      setProgress({
        percent: data.percent,
        text: '正在加载离线模式',
        detail: `已缓存 ${data.completed}/${data.total}：${data.url}`
      });
      return;
    }

    if (data.type === 'offline-cache-complete') {
      setProgress({
        percent: 100,
        text: '离线模式准备好了',
        detail: '单人小游戏已缓存，之后断网也能打开。'
      });
      hideProgress(1600);
      return;
    }

    if (data.type === 'offline-cache-error') {
      setProgress({
        percent: data.percent || 0,
        text: '离线缓存失败',
        detail: '联网后刷新页面可以重新尝试。'
      });
      hideProgress(4200);
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        if (registration.installing) {
          setProgress({
            percent: 1,
            text: '正在准备离线模式',
            detail: '首次加载会缓存大厅和单人小游戏资源。'
          });
        }
      })
      .catch(error => {
        console.warn('离线缓存注册失败:', error);
      });
  });
})();
