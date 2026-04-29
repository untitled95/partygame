(function registerOfflineCache() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('离线缓存注册失败:', error);
    });
  });
})();
