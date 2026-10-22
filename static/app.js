// Estado da Aplicação
const state = {
  allPhotos: [],
  filteredPhotos: [],
  displayedCount: 0,
  pageSize: 48,
  activeTab: 'all',
  searchQuery: '',
  sortOrder: 'asc',
  lightboxIndex: 0,
  serverInfo: null,
  isCloudHost: window.location.hostname.includes('github.io')
};

const PERMANENT_URL = 'https://rafascalfi.github.io/fotos-volei/';

// Elementos do DOM
const el = {
  statsSubHeader: document.getElementById('statsSubHeader'),
  statusPill: document.getElementById('statusPill'),
  statusText: document.getElementById('statusText'),
  tunnelBanner: document.getElementById('tunnelBanner'),
  tunnelUrlText: document.getElementById('tunnelUrlText'),
  btnCopyTunnelUrl: document.getElementById('btnCopyTunnelUrl'),
  btnWhatsappShare: document.getElementById('btnWhatsappShare'),
  btnShareHeader: document.getElementById('btnShareHeader'),
  
  badgeAll: document.getElementById('badgeAll'),
  badgeV1: document.getElementById('badgeV1'),
  badgeV2: document.getElementById('badgeV2'),
  badgeV3: document.getElementById('badgeV3'),
  badgeDebate: document.getElementById('badgeDebate'),
  
  tabBtns: document.querySelectorAll('.tab-btn'),
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  sortSelect: document.getElementById('sortSelect'),
  resultsCount: document.getElementById('resultsCount'),
  
  galleryGrid: document.getElementById('galleryGrid'),
  emptyState: document.getElementById('emptyState'),
  btnResetSearch: document.getElementById('btnResetSearch'),
  loadMoreContainer: document.getElementById('loadMoreContainer'),
  btnLoadMore: document.getElementById('btnLoadMore'),
  
  // Lightbox
  lightbox: document.getElementById('lightbox'),
  lightboxOverlay: document.getElementById('lightboxOverlay'),
  lbCounter: document.getElementById('lbCounter'),
  lbCategory: document.getElementById('lbCategory'),
  lbFilename: document.getElementById('lbFilename'),
  lbImage: document.getElementById('lbImage'),
  lbSpinner: document.getElementById('lbSpinner'),
  lbFilesize: document.getElementById('lbFilesize'),
  lbBtnClose: document.getElementById('lbBtnClose'),
  lbBtnPrev: document.getElementById('lbBtnPrev'),
  lbBtnNext: document.getElementById('lbBtnNext'),
  lbBtnDownload: document.getElementById('lbBtnDownload'),
  lbBtnDownloadTop: document.getElementById('lbBtnDownloadTop'),
  lbBtnCopyLink: document.getElementById('lbBtnCopyLink'),
  
  fabTop: document.getElementById('fabTop'),
  toast: document.getElementById('toast')
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

let toastTimeout = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.toast.classList.remove('show');
  }, 2800);
}

async function copyToClipboard(text, successMsg = 'Link copiado com sucesso!') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(successMsg);
  } catch (err) {
    showToast('Erro ao copiar link');
  }
}

function resolvePhotoUrl(photo) {
  if (!state.isCloudHost) {
    return photo.photo_url;
  }
  const activeTunnel = state.serverInfo?.tunnel_url;
  if (activeTunnel && activeTunnel.startsWith('https://') && !activeTunnel.includes('github.io')) {
    return `${activeTunnel}${photo.orig_path}`;
  }
  return photo.thumb_url;
}

function resolveDownloadUrl(photo) {
  if (!state.isCloudHost) {
    return photo.download_url;
  }
  const activeTunnel = state.serverInfo?.tunnel_url;
  if (activeTunnel && activeTunnel.startsWith('https://') && !activeTunnel.includes('github.io')) {
    return `${activeTunnel}${photo.dl_path}`;
  }
  return photo.thumb_url;
}

async function checkServerInfo() {
  try {
    const endpoint = state.isCloudHost ? `tunnel.json?t=${Date.now()}` : '/api/info';
    const res = await fetch(endpoint);
    if (!res.ok) return;
    const data = await res.json();
    state.serverInfo = data;

    const dot = el.statusPill.querySelector('.status-dot');
    const shareUrl = data.permanent_url || PERMANENT_URL;

    dot.classList.add('online');
    el.statusText.textContent = 'Online Permanente';
    
    el.tunnelBanner.style.display = 'block';
    el.tunnelUrlText.textContent = shareUrl;
    el.btnShareHeader.style.display = 'inline-flex';
    
    const msg = encodeURIComponent(`Confira as fotos do Vôlei de Areia: ${shareUrl}`);
    el.btnWhatsappShare.href = `https://api.whatsapp.com/send?text=${msg}`;
  } catch (e) {
    console.warn('Verificando status do servidor...', e);
  }
}

async function loadPhotos() {
  try {
    const endpoint = state.isCloudHost ? 'photos.json' : '/api/photos';
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Falha ao carregar catálogo');
    const data = await res.json();
    
    state.allPhotos = data.photos;
    
    const stats = data.stats;
    el.badgeAll.textContent = stats.total.toLocaleString();
    el.badgeV1.textContent = stats.volei1.toLocaleString();
    el.badgeV2.textContent = stats.volei2.toLocaleString();
    el.badgeV3.textContent = stats.volei3.toLocaleString();
    if (el.badgeDebate && stats.debate2b !== undefined) {
      el.badgeDebate.textContent = stats.debate2b.toLocaleString();
    }
    
    el.statsSubHeader.textContent = `${stats.total.toLocaleString()} fotos • Vôlei 1 (${stats.volei1.toLocaleString()}) • Vôlei 2 (${stats.volei2.toLocaleString()}) • Vôlei 3 (${stats.volei3.toLocaleString()}) • Debate 2º B (${(stats.debate2b || 0).toLocaleString()})`;
    
    applyFilters();
  } catch (err) {
    el.statsSubHeader.textContent = 'Erro ao carregar fotos. Recarregue a página.';
    console.error(err);
  }
}

function applyFilters() {
  let list = state.allPhotos;

  if (state.activeTab !== 'all') {
    list = list.filter(p => p.folder === state.activeTab);
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(p => p.filename.toLowerCase().includes(q));
  }

  list = [...list].sort((a, b) => {
    if (state.sortOrder === 'asc') {
      return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' });
    } else {
      return b.filename.localeCompare(a.filename, undefined, { numeric: true, sensitivity: 'base' });
    }
  });

  state.filteredPhotos = list;
  state.displayedCount = 0;
  el.galleryGrid.innerHTML = '';

  if (list.length === 0) {
    el.resultsCount.textContent = 'Nenhuma foto encontrada';
    el.emptyState.style.display = 'block';
    el.loadMoreContainer.style.display = 'none';
  } else {
    el.emptyState.style.display = 'none';
    el.resultsCount.textContent = `Mostrando ${Math.min(state.pageSize, list.length)} de ${list.length.toLocaleString()} fotos`;
    renderNextBatch();
  }
}

function getBadgeStyle(folder) {
  if (folder === 'volei1') return { cls: 'badge-v1', label: 'Vôlei 1', color: 'var(--accent-purple)' };
  if (folder === 'volei2') return { cls: 'badge-v2', label: 'Vôlei 2', color: 'var(--accent-amber)' };
  if (folder === 'volei3') return { cls: 'badge-v3', label: 'Vôlei 3', color: 'var(--accent-emerald)' };
  return { cls: 'badge-debate', label: 'Debate 2º B', color: 'var(--accent-blue)' };
}

function renderNextBatch() {
  const start = state.displayedCount;
  const end = Math.min(start + state.pageSize, state.filteredPhotos.length);
  const batch = state.filteredPhotos.slice(start, end);

  if (batch.length === 0) {
    el.loadMoreContainer.style.display = 'none';
    return;
  }

  const fragment = document.createDocumentFragment();

  batch.forEach((photo, idx) => {
    const overallIndex = start + idx;
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.setAttribute('data-index', overallIndex);

    const badgeInfo = getBadgeStyle(photo.folder);

    card.innerHTML = `
      <div class="card-image-box">
        <div class="card-badges">
          <span class="badge-tag ${badgeInfo.cls}">${badgeInfo.label}</span>
        </div>
        <img class="card-img" 
             src="${photo.thumb_url}" 
             alt="${photo.filename}" 
             loading="lazy" 
             decoding="async">
        <div class="card-overlay">
          <div class="overlay-info">
            <span class="card-filename">${photo.filename}</span>
            <span class="card-size">${formatBytes(photo.size)}</span>
          </div>
          <button class="btn-card-download" title="Baixar foto" data-index="${overallIndex}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
        </div>
      </div>
      <div class="card-meta">
        <span>${photo.filename}</span>
        <span>${formatBytes(photo.size)}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-download')) {
        e.stopPropagation();
        triggerDownload(resolveDownloadUrl(photo), photo.filename, photo.thumb_url);
        return;
      }
      openLightbox(overallIndex);
    });

    fragment.appendChild(card);
  });

  el.galleryGrid.appendChild(fragment);
  state.displayedCount = end;

  el.resultsCount.textContent = `Mostrando ${state.displayedCount.toLocaleString()} de ${state.filteredPhotos.length.toLocaleString()} fotos`;

  if (state.displayedCount >= state.filteredPhotos.length) {
    el.loadMoreContainer.style.display = 'none';
  } else {
    el.loadMoreContainer.style.display = 'block';
  }
}

function triggerDownload(url, filename, fallbackUrl) {
  const a = document.createElement('a');
  a.href = url || fallbackUrl;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Baixando ${filename}...`);
}

function openLightbox(index) {
  if (index < 0 || index >= state.filteredPhotos.length) return;
  state.lightboxIndex = index;

  const photo = state.filteredPhotos[index];
  const badgeInfo = getBadgeStyle(photo.folder);
  const fullUrl = resolvePhotoUrl(photo);
  const dlUrl = resolveDownloadUrl(photo);
  
  el.lbCounter.textContent = `${index + 1} / ${state.filteredPhotos.length.toLocaleString()}`;
  el.lbCategory.textContent = photo.category;
  el.lbCategory.style.background = badgeInfo.color;
  el.lbFilename.textContent = photo.filename;
  el.lbFilesize.textContent = `Tamanho original: ${formatBytes(photo.size)}`;
  
  el.lbBtnDownload.href = dlUrl;
  el.lbBtnDownload.setAttribute('download', photo.filename);
  el.lbBtnDownloadTop.href = dlUrl;
  el.lbBtnDownloadTop.setAttribute('download', photo.filename);

  el.lbSpinner.style.display = 'block';
  el.lbImage.style.opacity = '0';

  const newImg = new Image();
  newImg.src = fullUrl;
  newImg.onload = () => {
    el.lbImage.src = newImg.src;
    el.lbSpinner.style.display = 'none';
    el.lbImage.style.opacity = '1';
  };
  newImg.onerror = () => {
    el.lbImage.src = photo.thumb_url;
    el.lbSpinner.style.display = 'none';
    el.lbImage.style.opacity = '1';
    el.lbBtnDownload.href = photo.thumb_url;
    el.lbBtnDownloadTop.href = photo.thumb_url;
  };

  if (index + 1 < state.filteredPhotos.length) {
    const preloadImg = new Image();
    preloadImg.src = resolvePhotoUrl(state.filteredPhotos[index + 1]);
  }

  el.lightbox.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  el.lightbox.style.display = 'none';
  document.body.style.overflow = '';
}

function nextPhoto() {
  if (state.lightboxIndex + 1 < state.filteredPhotos.length) {
    openLightbox(state.lightboxIndex + 1);
  } else {
    openLightbox(0);
  }
}

function prevPhoto() {
  if (state.lightboxIndex - 1 >= 0) {
    openLightbox(state.lightboxIndex - 1);
  } else {
    openLightbox(state.filteredPhotos.length - 1);
  }
}

el.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    el.tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeTab = btn.getAttribute('data-tab');
    applyFilters();
  });
});

let searchDebounce = null;
el.searchInput.addEventListener('input', (e) => {
  const val = e.target.value;
  state.searchQuery = val;
  el.searchClear.style.display = val ? 'block' : 'none';

  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    applyFilters();
  }, 120);
});

el.searchClear.addEventListener('click', () => {
  el.searchInput.value = '';
  state.searchQuery = '';
  el.searchClear.style.display = 'none';
  applyFilters();
});

el.btnResetSearch.addEventListener('click', () => {
  el.searchInput.value = '';
  state.searchQuery = '';
  el.searchClear.style.display = 'none';
  applyFilters();
});

el.sortSelect.addEventListener('change', (e) => {
  state.sortOrder = e.target.value;
  applyFilters();
});

el.btnLoadMore.addEventListener('click', () => {
  renderNextBatch();
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.displayedCount < state.filteredPhotos.length) {
      renderNextBatch();
    }
  }, { rootMargin: '400px' });
  observer.observe(el.loadMoreContainer);
}

el.lbBtnClose.addEventListener('click', closeLightbox);
el.lightboxOverlay.addEventListener('click', closeLightbox);
el.lbBtnNext.addEventListener('click', nextPhoto);
el.lbBtnPrev.addEventListener('click', prevPhoto);

window.addEventListener('keydown', (e) => {
  if (el.lightbox.style.display === 'flex') {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
  }
});

let touchStartX = 0;
let touchEndX = 0;
el.lightbox.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

el.lightbox.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchEndX - touchStartX;
  if (Math.abs(diff) > 50) {
    if (diff < 0) nextPhoto();
    else prevPhoto();
  }
}, { passive: true });

el.lbBtnCopyLink.addEventListener('click', () => {
  const photo = state.filteredPhotos[state.lightboxIndex];
  if (!photo) return;
  const photoLink = `${PERMANENT_URL}?q=${encodeURIComponent(photo.filename)}`;
  copyToClipboard(photoLink, 'Link direto da foto copiado!');
});

el.btnCopyTunnelUrl.addEventListener('click', () => {
  copyToClipboard(PERMANENT_URL, 'Link permanente copiado! Pronto para colar no WhatsApp.');
});

el.btnShareHeader.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Fotos Vôlei de Areia',
        text: 'Confira todas as fotos do Vôlei de Areia:',
        url: PERMANENT_URL
      });
    } catch (err) {
      copyToClipboard(PERMANENT_URL);
    }
  } else {
    copyToClipboard(PERMANENT_URL);
  }
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    el.fabTop.classList.add('visible');
  } else {
    el.fabTop.classList.remove('visible');
  }
}, { passive: true });

el.fabTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q');
  if (qParam) {
    el.searchInput.value = qParam;
    state.searchQuery = qParam;
    el.searchClear.style.display = 'block';
  }
  loadPhotos();
  checkServerInfo();
  setInterval(() => {
    checkServerInfo();
  }, 15000);
});
