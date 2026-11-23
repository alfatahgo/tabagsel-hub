// ============================================================
// TABAGSEL HUB - Main Public Application Logic
// Platform Managed Brokerage Properti, Otomotif & Jasa Tabagsel
// ============================================================

// Pastikan halaman selalu kembali ke paling atas saat di-refresh
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});

let catalogData = [];
let searchTimeout = null;

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.location.hash) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  // Init Supabase
  initSupabase();

  // Track referral
  saveReferralCode();

  // Set WA float link
  const waFloatEl = document.getElementById('waFloat');
  if (waFloatEl) {
    waFloatEl.href = waLink('Halo Admin Tabagsel Hub, saya ingin bertanya tentang properti, otomotif atau jasa.');
  }

  // Set rekening info
  const rekInfo = `${CONFIG.REKENING.bank} - ${CONFIG.REKENING.nomor} a.n. ${CONFIG.REKENING.atas_nama}`;
  const rekElements = ['bookingRekening', 'jasaRekening'];
  rekElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = rekInfo;
  });

  // Set harga jasa survei
  const regEl = document.getElementById('hargaReguler');
  if (regEl) regEl.textContent = formatRupiah(CONFIG.TARIF_JASA_SURVEI.REGULER);
  const vipEl = document.getElementById('hargaVIP');
  if (vipEl) vipEl.textContent = formatRupiah(CONFIG.TARIF_JASA_SURVEI.VIP);

  // Set min date for booking
  const today = new Date().toISOString().split('T')[0];
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => input.setAttribute('min', today));

  // Update badge favorit dari localStorage
  updateNavFavBadge();

  // Load catalog & sayembara
  await Promise.all([loadCatalog(), loadSayembara()]);

  // Cek Deep Link URL (?aset=KODE_ASET)
  checkDeepLink();

  // Setup filter category change
  const katEl = document.getElementById('filterKategori');
  if (katEl) katEl.addEventListener('change', updateSubKategoriOptions);

  // Inisialisasi Popup Penjaring Titip Jual Aset
  initPopupTitipJual();
});

// ============================================================
// FILTER & SEARCH LOGIC
// ============================================================
function updateSubKategoriOptions() {
  const kategori = document.getElementById('filterKategori').value;
  const subSelect = document.getElementById('filterSubKategori');
  if (!subSelect) return;
  subSelect.innerHTML = '<option value="">Semua Tipe</option>';

  if (kategori && CONFIG.KATEGORI[kategori]) {
    CONFIG.KATEGORI[kategori].sub.forEach(s => {
      subSelect.innerHTML += `<option value="${s.value}">${s.label}</option>`;
    });
  } else {
    // Show all subcategories
    Object.values(CONFIG.KATEGORI).forEach(cat => {
      cat.sub.forEach(s => {
        subSelect.innerHTML += `<option value="${s.value}">${s.label}</option>`;
      });
    });
  }
}

function onFilterChange() {
  loadCatalog();
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadCatalog(), 350);
}

// 8 Ikon Layanan Cepat (Floating Grid) Handler
function selectQuickFilter(kategori, subKategori = '') {
  const katSelect = document.getElementById('filterKategori');
  const subSelect = document.getElementById('filterSubKategori');

  if (katSelect) katSelect.value = kategori || '';
  updateSubKategoriOptions();

  if (subSelect && subKategori) {
    subSelect.value = subKategori;
  }

  // Highlight active quick icon card
  document.querySelectorAll('.quick-icon-item').forEach(el => el.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  loadCatalog();

  // Smooth scroll to catalog section
  const katSection = document.getElementById('katalog');
  if (katSection) {
    katSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function filterByKategoriUtama(kategori, subKategori = '') {
  selectQuickFilter(kategori, subKategori);
}

function resetAllFilters() {
  const searchInput = document.getElementById('filterSearch');
  if (searchInput) searchInput.value = '';

  const wilSelect = document.getElementById('filterWilayah');
  if (wilSelect) wilSelect.value = '';

  const katSelect = document.getElementById('filterKategori');
  if (katSelect) katSelect.value = '';

  updateSubKategoriOptions();

  document.querySelectorAll('.quick-icon-item').forEach(el => el.classList.remove('active'));
  loadCatalog();
}

// Helper: Format Rupiah Ringkas (e.g. Rp 350 JT, Rp 1,5 M)
function formatRupiahRingkas(angka) {
  const num = Number(angka);
  if (isNaN(num) || num === 0) return 'Rp 0';
  if (num >= 1000000000) {
    const m = (num / 1000000000).toFixed(1).replace('.0', '');
    return `Rp ${m.replace('.', ',')} M`;
  }
  if (num >= 1000000) {
    const jt = (num / 1000000).toFixed(0);
    return `Rp ${jt} JT`;
  }
  if (num >= 1000) {
    const rb = (num / 1000).toFixed(0);
    return `Rp ${rb} RB`;
  }
  return formatRupiah(num);
}

function getSpecIcon(key) {
  const k = key.toLowerCase();
  if (k.includes('tanah') || k.includes('lt')) return { icon: 'fas fa-vector-square', label: 'LT' };
  if (k.includes('bangunan') || k.includes('lb')) return { icon: 'fas fa-ruler-combined', label: 'LB' };
  if (k.includes('tidur') || k.includes('kt')) return { icon: 'fas fa-bed', label: 'KT' };
  if (k.includes('mandi') || k.includes('km')) return { icon: 'fas fa-bath', label: 'KM' };
  if (k.includes('tahun')) return { icon: 'fas fa-calendar-alt', label: 'THN' };
  if (k.includes('transmisi')) return { icon: 'fas fa-cog', label: 'TRN' };
  if (k.includes('km') || k.includes('jarak')) return { icon: 'fas fa-tachometer-alt', label: 'KM' };
  if (k.includes('pajak')) return { icon: 'fas fa-receipt', label: 'PJK' };
  if (k.includes('garansi')) return { icon: 'fas fa-shield-alt', label: 'GAR' };
  if (k.includes('estimasi') || k.includes('waktu')) return { icon: 'fas fa-clock', label: 'EST' };
  return { icon: 'fas fa-check-circle', label: key.substring(0, 3).toUpperCase() };
}

// ============================================================
// LOAD & RENDER CATALOG
// ============================================================
async function loadCatalog() {
  const skeleton = document.getElementById('catalogSkeleton');
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('emptyState');

  if (skeleton) skeleton.classList.remove('hidden');
  if (grid) grid.classList.add('hidden');
  if (empty) empty.classList.add('hidden');

  try {
    const filters = {
      kategori: document.getElementById('filterKategori')?.value || undefined,
      sub_kategori: document.getElementById('filterSubKategori')?.value || undefined,
      kabupaten: document.getElementById('filterWilayah')?.value || undefined,
      search: document.getElementById('filterSearch')?.value || undefined,
    };

    catalogData = await fetchPublicAssets(filters);

    if (skeleton) skeleton.classList.add('hidden');

    if (filterOnlyFavorites) {
      const favs = getFavorites();
      catalogData = (catalogData || []).filter(a => favs.includes(a.id));
    }

    if (!catalogData || catalogData.length === 0) {
      if (empty) empty.classList.remove('hidden');
      const countEl = document.getElementById('resultCount');
      if (countEl) countEl.textContent = '0 aset / jasa ditemukan';
    } else {
      if (grid) grid.classList.remove('hidden');
      const countEl = document.getElementById('resultCount');
      if (countEl) countEl.textContent = `${catalogData.length} pilihan terverifikasi ${filterOnlyFavorites ? '(Favorit ⭐)' : ''}`;
      renderCatalog(catalogData);
      checkDeepLink();
    }
  } catch (err) {
    if (skeleton) skeleton.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    console.error('Error loading catalog:', err);
  }
}

function renderCatalog(assets) {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  // Render Featured Highlight (jika ada)
  const featuredRack = document.getElementById('featuredRack');
  const featuredSection = document.getElementById('featuredSection');
  if (featuredRack && featuredSection) {
    const featuredItems = assets.slice(0, 3);
    if (featuredItems.length > 0) {
      featuredSection.classList.remove('hidden');
      featuredRack.innerHTML = featuredItems.map(asset => renderBrightonCard(asset, true)).join('');
    } else {
      featuredSection.classList.add('hidden');
    }
  }

  grid.innerHTML = assets.map(asset => renderBrightonCard(asset)).join('');
}

function renderBrightonCard(asset, isFeatured = false) {
  const isJasa = asset.kategori_utama === 'JASA_SERVIS';
  const isOto = asset.kategori_utama === 'OTOMOTIF';
  const imgUrl = asset.foto_utama ? cloudinaryOptimize(asset.foto_utama, true) : 'assets/images/default-listing.jpg';
  const viewCount = getAssetViewCount(asset.id);
  const isHot = viewCount >= 5;
  const favActive = isFavorite(asset.id);

  const specs = asset.spesifikasi || {};
  const specEntries = Object.entries(specs).slice(0, 4);

  const specsHtml = specEntries.length > 0 ? specEntries.map(([k, v]) => {
    const info = getSpecIcon(k);
    return `
      <span class="card-spec-item" title="${k}: ${v}">
        <i class="${info.icon} text-amber-500"></i>
        <span>${v}</span>
      </span>
    `;
  }).join('') : `
    <span class="card-spec-item text-slate-500">
      <i class="fas fa-shield-alt text-amber-500"></i>
      <span>Terverifikasi Tabagsel Hub</span>
    </span>
  `;

  const waMsg = encodeURIComponent(`Halo Admin Tabagsel Hub, saya tertarik dengan ${isJasa ? 'layanan jasa' : 'aset'} ${asset.kode_aset} (${asset.judul}) di ${asset.kabupaten}. Mohon informasi ketersediaan resminya.`);
  const waUrl = `https://wa.me/${CONFIG.ADMIN_WHATSAPP}?text=${waMsg}`;

  const categoryLabel = isJasa ? 'JASA & SERVIS' : (isOto ? 'OTOMOTIF' : 'PROPERTI');

  return `
    <div class="asset-card-brighton group">
      <!-- Media 16:9 with Badges -->
      <div class="asset-media-container cursor-pointer relative" onclick="openDetail('${asset.id}')">
        <img src="${imgUrl}" alt="${asset.judul}" loading="lazy" onerror="this.src='assets/images/default-listing.jpg'">
        
        <!-- Top Left Badge: Terverifikasi Lapangan -->
        <span class="badge-verified-top">
          <i class="fas fa-shield-check text-amber-400"></i> Terverifikasi Lapangan
        </span>

        <!-- Hot Tag if views >= 5 -->
        ${isHot ? `
          <span class="badge-hot-tag">
            <i class="fas fa-fire"></i> Hot Aset
          </span>
        ` : ''}

        <!-- Top Right: Favorite Button -->
        <button type="button" onclick="event.stopPropagation(); toggleFavorite('${asset.id}')" class="card-fav-btn ${favActive ? 'active' : ''}" title="${favActive ? 'Hapus dari Favorit' : 'Simpan ke Favorit'}">
          <i class="${favActive ? 'fas fa-heart text-rose-500' : 'far fa-heart'}"></i>
        </button>

        <!-- Subtle Watermark Anti-Bypass -->
        <span class="asset-watermark-overlay">
          Tabagsel Hub • Verified
        </span>

        <!-- Bottom Right Badge: Kategori -->
        <span class="badge-category-top">
          ${categoryLabel}
        </span>
      </div>

      <!-- Content Body -->
      <div class="p-4 cursor-pointer flex-1 flex flex-col justify-between" onclick="openDetail('${asset.id}')">
        <div>
          <!-- Price Line with Bisa Nego Tag -->
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <div>
              <span class="text-gold font-black text-2xl tracking-tight">
                ${isJasa ? 'Mulai ' : ''}${formatRupiahRingkas(asset.harga_tayang)}
              </span>
              ${asset.satuan_harga && asset.satuan_harga !== 'Total' ? `
                <span class="text-xs text-slate-400 font-semibold">/ ${asset.satuan_harga}</span>
              ` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              ${viewCount > 0 ? `<span class="text-[10px] text-slate-400 font-mono"><i class="fas fa-eye text-slate-400"></i> ${viewCount}</span>` : ''}
              <span class="badge-nego-pill">Bisa Nego</span>
            </div>
          </div>

          <p class="text-[11px] text-slate-500 font-medium mb-2">
            ${isJasa ? 'Estimasi Biaya: ' : 'Harga Tayang: '}${formatRupiah(asset.harga_tayang)}
          </p>

          <!-- Title -->
          <h3 class="font-bold text-navy text-sm md:text-base leading-snug line-clamp-2 group-hover:text-gold transition-colors mb-2">
            ${asset.judul}
          </h3>

          <!-- Location -->
          <p class="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
            <i class="fas fa-map-marker-alt text-rose-500 text-xs"></i>
            <span>${asset.kecamatan ? asset.kecamatan + ', ' : ''}<strong class="text-slate-700">${asset.kabupaten}</strong></span>
          </p>

          <!-- Specifications Row -->
          <div class="flex flex-wrap gap-1.5">
            ${specsHtml}
          </div>
        </div>
      </div>

      <!-- Card Official Footer -->
      <div class="card-official-footer">
        <div class="flex items-center gap-1.5">
          <i class="fas fa-landmark text-amber-500"></i>
          <span class="font-semibold text-slate-600">Dikelola Resmi Tabagsel Hub</span>
        </div>

        <div class="flex items-center gap-1.5">
          <button type="button" onclick="event.stopPropagation(); shareAssetWA('${asset.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors" title="Bagikan ke WhatsApp">
            <i class="fas fa-share-nodes text-xs"></i>
          </button>
          <a href="${waUrl}" target="_blank" onclick="event.stopPropagation()" class="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors" title="Hubungi Admin WhatsApp">
            <i class="fab fa-whatsapp text-sm"></i>
          </a>
          <button onclick="openDetail('${asset.id}')" class="btn-gold text-xs py-1.5 px-3 rounded-lg font-bold">
            ${isJasa ? 'Pesan Jasa' : 'Lihat Detail'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// MODAL DETAIL ASET
// ============================================================
let currentDetailAssetId = null;

function openDetail(assetId) {
  const asset = catalogData.find(a => a.id === assetId);
  if (!asset) return;

  currentDetailAssetId = asset.id;

  // Track view counter (Local & Supabase RPC)
  const localViews = trackAssetView(asset.id);
  const baseViews = Number(asset.views_count) || 0;
  const displayViews = Math.max(localViews, baseViews + (localViews > 1 ? 1 : 0));
  const viewCountEl = document.getElementById('detailViewCount');
  if (viewCountEl) viewCountEl.textContent = displayViews;

  // Trigger increment view ke Supabase secara asynchronous
  if (typeof rpcIncrementAssetView === 'function') {
    rpcIncrementAssetView(asset.kode_aset);
  }

  // Update favorite button state
  updateDetailFavBtn();

  const badge = document.getElementById('detailBadge');
  if (badge) {
    badge.textContent = asset.status || 'Tersedia';
    badge.className = 'badge-tersedia text-xs px-3 py-1 rounded-full font-semibold';
  }

  document.getElementById('detailJudul').textContent = asset.judul;
  document.getElementById('detailKode').textContent = asset.kode_aset;
  document.getElementById('detailHarga').textContent = formatRupiah(asset.harga_tayang);
  document.getElementById('detailSatuan').textContent = asset.satuan_harga && asset.satuan_harga !== 'Total' ? `per ${asset.satuan_harga}` : '';
  document.getElementById('detailDeskripsi').textContent = asset.deskripsi || 'Deskripsi terkurasi resmi oleh staf Tabagsel Hub.';
  document.getElementById('detailLokasi').textContent = `${asset.kecamatan ? asset.kecamatan + ', ' : ''}${asset.kabupaten}`;

  // Gallery (tetap 2 foto sesuai arahan user)
  const gallery = document.getElementById('detailGallery');
  let galleryHtml = '';
  if (asset.foto_utama) {
    galleryHtml += `
      <div class="relative rounded-xl overflow-hidden border border-slate-200">
        <img src="${cloudinaryOptimize(asset.foto_utama, true)}" class="w-full h-56 object-cover" alt="Foto Utama">
        <span class="asset-watermark-overlay">Tabagsel Hub • Verified</span>
      </div>
    `;
  }
  if (asset.foto_kedua) {
    galleryHtml += `
      <div class="relative rounded-xl overflow-hidden border border-slate-200">
        <img src="${cloudinaryOptimize(asset.foto_kedua, true)}" class="w-full h-56 object-cover" alt="Foto Kedua">
        <span class="asset-watermark-overlay">Tabagsel Hub • Verified</span>
      </div>
    `;
  }
  if (!galleryHtml) {
    galleryHtml = '<div class="bg-slate-100 rounded-xl h-56 flex items-center justify-center col-span-2 border border-slate-200"><i class="fas fa-image text-4xl text-slate-300"></i></div>';
  }
  gallery.innerHTML = galleryHtml;

  // Specs
  const specsDiv = document.getElementById('detailSpecs');
  const specs = asset.spesifikasi || {};
  specsDiv.innerHTML = Object.entries(specs).map(([k, v]) => `
    <div class="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
      <p class="text-[11px] text-slate-500 uppercase font-semibold">${k}</p>
      <p class="font-bold text-navy text-xs md:text-sm">${v}</p>
    </div>
  `).join('');

  // External Links (Instagram, TikTok, Facebook, YouTube Video)
  const extLinks = document.getElementById('detailExternalLinks');
  const igUrl = asset.link_instagram || 'https://instagram.com/tabagselhub';
  const tiktokUrl = asset.link_tiktok || 'https://tiktok.com/@tabagselhub';
  const fbUrl = asset.link_facebook || 'https://facebook.com/tabagselhub';

  let linksHtml = `
    <div class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mt-1">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-navy flex items-center gap-1.5">
          <i class="fas fa-photo-film text-gold"></i> Cek Data & Video Lengkap:
        </span>
        <span class="text-[10px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
          2 Foto di Web • Video Lengkap di Medsos
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="${igUrl}" target="_blank" class="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 shadow-sm transition-all" title="Buka Video Dokumentasi di Instagram">
          <i class="fab fa-instagram"></i> Instagram
        </a>
        <a href="${tiktokUrl}" target="_blank" class="inline-flex items-center gap-1.5 bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black shadow-sm transition-all" title="Buka Video Review di TikTok">
          <i class="fab fa-tiktok"></i> TikTok
        </a>
        <a href="${fbUrl}" target="_blank" class="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all" title="Buka Album Foto & Dokumentasi di Facebook">
          <i class="fab fa-facebook"></i> Facebook
        </a>
        ${asset.link_youtube ? `
          <a href="${asset.link_youtube}" target="_blank" class="inline-flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm transition-all" title="Tonton Video Drone di YouTube">
            <i class="fab fa-youtube"></i> YouTube
          </a>
        ` : ''}
      </div>
    </div>
  `;
  extLinks.innerHTML = linksHtml;

  // Action Buttons
  const actions = document.getElementById('detailActions');
  const isJasa = asset.kategori_utama === 'JASA_SERVIS';
  const isSewa = asset.sub_kategori && (asset.sub_kategori.toLowerCase().includes('sewa') || asset.sub_kategori.toLowerCase().includes('rental'));

  let actionsHtml = '';
  if (isJasa) {
    const waPesan = waLink(`Halo Admin Tabagsel Hub, saya ingin memesan layanan jasa ${asset.judul} (${asset.kode_aset}) untuk wilayah ${asset.kabupaten}. Mohon jadwalkan teknisi resmi.`);
    actionsHtml += `<a href="${waPesan}" target="_blank" class="btn-gold w-full py-3 rounded-xl text-sm font-bold justify-center flex items-center gap-2 shadow-md"><i class="fas fa-tools mr-1"></i>Pesan Layanan Jasa via Admin</a>`;
    actionsHtml += `<a href="${waPesan}" target="_blank" class="btn-whatsapp w-full py-2.5 rounded-xl text-xs font-bold justify-center flex items-center gap-2"><i class="fab fa-whatsapp text-base"></i>Konsultasi Teknis WhatsApp</a>`;
  } else if (isSewa) {
    actionsHtml += `<button onclick="openBookingSewa('${asset.id}', '${asset.judul}')" class="btn-gold w-full py-3 rounded-xl text-sm font-bold"><i class="fas fa-key mr-2"></i>Booking Sewa & Pembayaran DP</button>`;
    actionsHtml += `<a href="${waLink('Halo Admin Tabagsel Hub, saya tertarik dengan sewa aset ' + asset.kode_aset + ' - ' + asset.judul)}" target="_blank" class="btn-whatsapp w-full py-2.5 rounded-xl text-xs font-bold justify-center flex items-center gap-2"><i class="fab fa-whatsapp text-base"></i>Tanya Admin WhatsApp</a>`;
  } else {
    actionsHtml += `<button onclick="openBookingSurvei('${asset.id}', '${asset.kode_aset}', '${asset.judul}', '${asset.kabupaten}')" class="btn-gold w-full py-3 rounded-xl text-sm font-bold shadow-md"><i class="fas fa-calendar-check mr-2"></i>Jadwalkan Survei Lapangan Resmi</button>`;
    actionsHtml += `<a href="${waLink('Halo Admin Tabagsel Hub, saya ingin bertanya tentang aset ' + asset.kode_aset + ' - ' + asset.judul)}" target="_blank" class="btn-whatsapp w-full py-2.5 rounded-xl text-xs font-bold justify-center flex items-center gap-2"><i class="fab fa-whatsapp text-base"></i>Konsultasi Nego via Admin</a>`;
  }
  actions.innerHTML = actionsHtml;

  // Update Share WhatsApp button label dynamically based on sector
  const btnShare = document.getElementById('btnDetailShareWA');
  if (btnShare) {
    const catInfo = getAssetCategoryInfo(asset);
    btnShare.innerHTML = `<i class="fab fa-whatsapp text-base"></i> ${catInfo.shareBtnText}`;
    btnShare.title = catInfo.shareBtnText;
  }

  openModal('modalDetail');
}

// ============================================================
// HELPER FITUR BARU: WISHLIST / FAVORIT (LOCALSTORAGE)
// ============================================================
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('tabagsel_favorites') || '[]');
  } catch (e) {
    return [];
  }
}

function isFavorite(assetId) {
  const favs = getFavorites();
  return favs.includes(assetId);
}

function toggleFavorite(assetId) {
  let favs = getFavorites();
  if (favs.includes(assetId)) {
    favs = favs.filter(id => id !== assetId);
    showToast('Aset dihapus dari favorit', 'info');
  } else {
    favs.push(assetId);
    showToast('Aset disimpan ke favorit! ⭐', 'success');
  }
  localStorage.setItem('tabagsel_favorites', JSON.stringify(favs));
  updateNavFavBadge();
  loadCatalog();
  updateDetailFavBtn();
}

function toggleFavoriteCurrent() {
  if (currentDetailAssetId) {
    toggleFavorite(currentDetailAssetId);
  }
}

function updateDetailFavBtn() {
  const btn = document.getElementById('detailFavBtn');
  if (!btn || !currentDetailAssetId) return;
  const active = isFavorite(currentDetailAssetId);
  btn.innerHTML = `<i class="${active ? 'fas fa-heart text-rose-500' : 'far fa-heart'}"></i>`;
  btn.title = active ? 'Hapus dari Favorit' : 'Simpan ke Favorit';
}

function updateNavFavBadge() {
  const badge = document.getElementById('navFavBadge');
  if (!badge) return;
  const count = getFavorites().length;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

let filterOnlyFavorites = false;

function filterByFavorites() {
  filterOnlyFavorites = !filterOnlyFavorites;
  const favs = getFavorites();
  if (filterOnlyFavorites && favs.length === 0) {
    showToast('Belum ada aset tersimpan di favorit Anda.', 'info');
    filterOnlyFavorites = false;
    return;
  }
  showToast(filterOnlyFavorites ? 'Menampilkan aset tersimpan ⭐' : 'Menampilkan semua aset', 'info');
  loadCatalog();
}

// ============================================================
// HELPER FITUR BARU: VIEW COUNTER & HOT PROPERTY
// ============================================================
function getAssetViewCount(assetId) {
  try {
    const views = JSON.parse(localStorage.getItem('tabagsel_views') || '{}');
    return views[assetId] || 0;
  } catch (e) {
    return 0;
  }
}

function trackAssetView(assetId) {
  try {
    const views = JSON.parse(localStorage.getItem('tabagsel_views') || '{}');
    views[assetId] = (views[assetId] || 0) + 1;
    localStorage.setItem('tabagsel_views', JSON.stringify(views));
    return views[assetId];
  } catch (e) {
    return 1;
  }
}

// ============================================================
// HELPER FITUR BARU: DEEP LINKING & SHARE TO WHATSAPP
// ============================================================
let deepLinkChecked = false;

function checkDeepLink() {
  if (deepLinkChecked) return;
  const params = new URLSearchParams(window.location.search);
  const kodeAset = params.get('aset') || params.get('id');
  if (!kodeAset) return;

  const match = catalogData.find(a => (a.kode_aset && a.kode_aset.toLowerCase() === kodeAset.toLowerCase()) || a.id === kodeAset);
  if (match) {
    deepLinkChecked = true;
    setTimeout(() => openDetail(match.id), 400);
  }
}

function getAssetCategoryInfo(asset) {
  const kode = (asset.kode_aset || '').toUpperCase();
  const kat = (asset.kategori_utama || '').toUpperCase();

  if (kat === 'PROPERTI' || kode.startsWith('TH-PRP') || kode.startsWith('PRP')) {
    return {
      type: 'PROPERTI',
      header: 'REKOMENDASI PROPERTI TERVERIFIKASI - TABAGSEL HUB',
      labelHarga: '💰 Harga:',
      cta: 'Lihat spesifikasi & jadwalkan survei lokasi:',
      shareBtnText: 'Bagikan Properti ke WhatsApp'
    };
  } else if (kat === 'OTOMOTIF' || kode.startsWith('TH-OTO') || kode.startsWith('OTO')) {
    return {
      type: 'OTOMOTIF',
      header: 'REKOMENDASI UNIT OTOMOTIF TERVERIFIKASI - TABAGSEL HUB',
      labelHarga: '💰 Harga:',
      cta: 'Lihat spesifikasi & jadwalkan cek unit resmi:',
      shareBtnText: 'Bagikan Unit ke WhatsApp'
    };
  } else if (kat === 'JASA_SERVIS' || kode.startsWith('TH-JSA') || kode.startsWith('JSA') || kat.includes('JASA')) {
    return {
      type: 'JASA_SERVIS',
      header: 'REKOMENDASI JASA & SERVIS TERVERIFIKASI - TABAGSEL HUB',
      labelHarga: '💰 Tarif Layanan:',
      cta: 'Lihat rincian layanan & jadwalkan pemesanan resmi:',
      shareBtnText: 'Bagikan Jasa ke WhatsApp'
    };
  }

  return {
    type: 'GENERAL',
    header: 'REKOMENDASI PROPERTI TERVERIFIKASI - TABAGSEL HUB',
    labelHarga: '💰 Harga:',
    cta: 'Lihat spesifikasi & jadwalkan survei lokasi:',
    shareBtnText: 'Bagikan ke WhatsApp'
  };
}

function shareAssetWA(assetId) {
  const asset = catalogData.find(a => a.id === assetId);
  if (!asset) return;

  const catInfo = getAssetCategoryInfo(asset);
  const currentUrl = window.location.origin + window.location.pathname + `?aset=${asset.kode_aset || asset.id}`;
  const hargaDisplay = `${formatRupiah(asset.harga_tayang)} ${asset.satuan_harga && asset.satuan_harga !== 'Total' ? '/ ' + asset.satuan_harga : ''}`.trim();

  const text = 
    `*${catInfo.header}*\n` +
    `🏷️ *${asset.judul}*\n` +
    `📍 Lokasi: ${asset.kecamatan ? asset.kecamatan + ', ' : ''}${asset.kabupaten}\n` +
    `${catInfo.labelHarga} ${hargaDisplay}\n` +
    `🛡️ Status: 100% Terverifikasi Lapangan & Bebas Calo\n\n` +
    `${catInfo.cta}\n${currentUrl}`;

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function shareCurrentAssetWA() {
  if (currentDetailAssetId) {
    shareAssetWA(currentDetailAssetId);
  }
}

// ============================================================
// HELPER FITUR BARU: KALKULATOR KPR & KREDIT KENDARAAN
// ============================================================
let currentKprType = 'properti';

function openKalkulatorKPR(presetPrice = null, presetType = 'properti') {
  if (presetType) switchKprType(presetType);
  if (presetPrice && presetPrice > 0) {
    document.getElementById('calcHargaAset').value = presetPrice;
    document.getElementById('calcDpNominal').value = Math.round(presetPrice * 0.2);
    document.getElementById('calcDpPercent').value = 20;
  }
  hitungKPR();
  openModal('modalKalkulatorKPR');
}

function openKprFromDetail() {
  if (!currentDetailAssetId) return;
  const asset = catalogData.find(a => a.id === currentDetailAssetId);
  if (!asset) return;
  const isOto = asset.kategori_utama === 'OTOMOTIF';
  openKalkulatorKPR(asset.harga_tayang, isOto ? 'otomotif' : 'properti');
}

function switchKprType(type) {
  currentKprType = type;
  const tabProp = document.getElementById('tabKprProperti');
  const tabOto = document.getElementById('tabKprOtomotif');
  const tenorSelect = document.getElementById('calcTenor');
  const bungaInput = document.getElementById('calcSukuBunga');
  const dpPercentInput = document.getElementById('calcDpPercent');

  if (type === 'properti') {
    tabProp.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-white text-navy shadow-sm';
    tabOto.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-navy';
    bungaInput.value = '6.5';
    dpPercentInput.value = '20';
    tenorSelect.innerHTML = `
      <option value="1">1 Tahun (12 Bulan)</option>
      <option value="3">3 Tahun (36 Bulan)</option>
      <option value="5">5 Tahun (60 Bulan)</option>
      <option value="10" selected>10 Tahun (120 Bulan)</option>
      <option value="15">15 Tahun (180 Bulan)</option>
      <option value="20">20 Tahun (240 Bulan)</option>
    `;
  } else {
    tabOto.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-white text-navy shadow-sm';
    tabProp.className = 'flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-navy';
    bungaInput.value = '8.5';
    dpPercentInput.value = '25';
    tenorSelect.innerHTML = `
      <option value="1">1 Tahun (12 Bulan)</option>
      <option value="2">2 Tahun (24 Bulan)</option>
      <option value="3" selected>3 Tahun (36 Bulan)</option>
      <option value="4">4 Tahun (48 Bulan)</option>
      <option value="5">5 Tahun (60 Bulan)</option>
    `;
  }
  updateDpFromPercent();
  hitungKPR();
}

function updateDpFromPercent() {
  const harga = parseFloat(document.getElementById('calcHargaAset')?.value) || 0;
  const percent = parseFloat(document.getElementById('calcDpPercent')?.value) || 0;
  const nominal = Math.round((harga * percent) / 100);
  document.getElementById('calcDpNominal').value = nominal;
  document.getElementById('calcDpPercentDisplay').textContent = `${percent}%`;
  hitungKPR();
}

function updateDpFromNominal() {
  const harga = parseFloat(document.getElementById('calcHargaAset')?.value) || 0;
  const nominal = parseFloat(document.getElementById('calcDpNominal')?.value) || 0;
  if (harga > 0) {
    const percent = Math.min(95, Math.max(5, Math.round((nominal / harga) * 100)));
    document.getElementById('calcDpPercent').value = percent;
    document.getElementById('calcDpPercentDisplay').textContent = `${percent}%`;
  }
  hitungKPR();
}

function hitungKPR() {
  const harga = parseFloat(document.getElementById('calcHargaAset')?.value) || 0;
  const dp = parseFloat(document.getElementById('calcDpNominal')?.value) || 0;
  const tenorTahun = parseInt(document.getElementById('calcTenor')?.value) || 10;
  const bungaTahunan = parseFloat(document.getElementById('calcSukuBunga')?.value) || 6.5;

  document.getElementById('calcHargaAsetFormatted').textContent = formatRupiah(harga);
  document.getElementById('calcDpNominalFormatted').textContent = formatRupiah(dp);

  const plafon = Math.max(0, harga - dp);
  document.getElementById('calcPokokPinjaman').textContent = formatRupiah(plafon);

  const totalBulan = tenorTahun * 12;
  const r = (bungaTahunan / 100) / 12;

  let cicilanBulan = 0;
  if (plafon > 0 && totalBulan > 0) {
    if (r > 0) {
      const factor = Math.pow(1 + r, totalBulan);
      cicilanBulan = Math.round(plafon * (r * factor) / (factor - 1));
    } else {
      cicilanBulan = Math.round(plafon / totalBulan);
    }
  }

  const totalBayar = dp + (cicilanBulan * totalBulan);
  document.getElementById('calcAngsuranBulanan').textContent = formatRupiah(cicilanBulan) + ' / bln';
  document.getElementById('calcTotalBayar').textContent = formatRupiah(totalBayar);
}

function konsultasiKprWA() {
  const harga = parseFloat(document.getElementById('calcHargaAset')?.value) || 0;
  const dp = parseFloat(document.getElementById('calcDpNominal')?.value) || 0;
  const tenor = document.getElementById('calcTenor')?.value || 10;
  const bunga = document.getElementById('calcSukuBunga')?.value || 6.5;
  const angsuran = document.getElementById('calcAngsuranBulanan')?.textContent || '';

  const pesan = 
    `*KONSULTASI SIMULASI KPR / CICILAN - TABAGSEL HUB*\n` +
    `Halo Admin, saya ingin konsultasi pengajuan pembiayaan ${currentKprType === 'properti' ? 'KPR Properti' : 'Kredit Kendaraan'} dengan rincian:\n\n` +
    `• Nilai Aset: ${formatRupiah(harga)}\n` +
    `• Uang Muka (DP): ${formatRupiah(dp)}\n` +
    `• Tenor: ${tenor} Tahun\n` +
    `• Estimasi Bunga/Margin: ${bunga}% / tahun\n` +
    `• Estimasi Cicilan: ${angsuran}\n\n` +
    `Mohon informasi bank / leasing rekanan resmi dan syarat pengajuannya. Terima kasih.`;

  window.open(waLink(pesan), '_blank');
}

// ============================================================
// BOOKING SURVEI
// ============================================================
function openBookingSurvei(assetId, kodeAset, judul, kabupaten) {
  closeModal('modalDetail');
  document.getElementById('bookingAssetId').value = assetId;
  document.getElementById('bookingKodeAset').value = kodeAset;
  document.getElementById('bookingAssetTitle').textContent = `${kodeAset} - ${judul}`;

  const biaya = CONFIG.TARIF_SURVEI[kabupaten] || 200000;
  document.getElementById('bookingBiaya').textContent = formatRupiah(biaya);
  document.getElementById('bookingBiaya').dataset.nominal = biaya;

  openModal('modalBookingSurvei');
}

async function submitBooking(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

  try {
    const buktiFile = document.getElementById('bookingBuktiFile').files[0];
    let buktiUrl = '';
    if (buktiFile) {
      buktiUrl = await uploadToCloudinary(buktiFile, CONFIG.CLOUDINARY_FOLDERS.BUKTI_PEMBAYARAN);
    }

    const data = {
      asset_id: document.getElementById('bookingAssetId').value,
      kode_aset: document.getElementById('bookingKodeAset').value,
      nama_pembeli: document.getElementById('bookingNama').value,
      wa_pembeli: document.getElementById('bookingWA').value,
      metode_survei: document.getElementById('bookingMetode').value,
      tanggal_survei: document.getElementById('bookingTanggal').value,
      jam_survei: document.getElementById('bookingJam').value,
      nominal_biaya_survei: parseInt(document.getElementById('bookingBiaya').dataset.nominal),
      bukti_transfer_url: buktiUrl,
      kode_mitra: getReferralCode(),
    };

    await submitBookingSurvei(data);

    closeModal('modalBookingSurvei');
    e.target.reset();
    document.getElementById('bookingBuktiPreview').classList.add('hidden');
    showToast('Booking survei berhasil dikirim! Admin akan segera memverifikasi pembayaran Anda.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengirim booking survei. Silakan coba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Booking Survei';
  }
}

// ============================================================
// BOOKING SEWA
// ============================================================
function openBookingSewa(assetId, judul) {
  closeModal('modalDetail');
  document.getElementById('sewaAssetId').value = assetId;
  document.getElementById('sewaAssetTitle').textContent = judul;
  openModal('modalBookingSewa');
}

async function submitBookingSewa(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

  try {
    const ktpFile = document.getElementById('sewaKTPFile').files[0];
    let ktpUrl = '';
    if (ktpFile) {
      ktpUrl = await uploadToCloudinary(ktpFile, CONFIG.CLOUDINARY_FOLDERS.IDENTITAS_SEWA);
    }

    const dpFile = document.getElementById('sewaDPFile').files[0];
    let dpUrl = '';
    if (dpFile) {
      dpUrl = await uploadToCloudinary(dpFile, CONFIG.CLOUDINARY_FOLDERS.BUKTI_PEMBAYARAN);
    }

    const data = {
      asset_id: document.getElementById('sewaAssetId').value,
      nama_pembeli: document.getElementById('sewaNama').value,
      wa_pembeli: document.getElementById('sewaWA').value,
      metode_survei: 'datang_langsung',
      tanggal_survei: document.getElementById('sewaMulai').value,
      jam_survei: document.getElementById('sewaSelesai').value,
      bukti_transfer_url: dpUrl,
      catatan_admin: `KTP: ${ktpUrl} | Periode Sewa: ${document.getElementById('sewaMulai').value} s/d ${document.getElementById('sewaSelesai').value}`,
      kode_mitra: getReferralCode(),
    };

    await submitBookingSurvei(data);

    closeModal('modalBookingSewa');
    e.target.reset();
    showToast('Booking sewa berhasil! Admin akan segera menghubungi Anda.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengirim booking sewa.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Booking Sewa';
  }
}

// ============================================================
// JASA WAKILI SURVEI
// ============================================================
async function submitJasaSurveiForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

  try {
    const buktiFile = document.getElementById('jasaBuktiFile').files[0];
    let buktiUrl = '';
    if (buktiFile) {
      buktiUrl = await uploadToCloudinary(buktiFile, CONFIG.CLOUDINARY_FOLDERS.BUKTI_PEMBAYARAN);
    }

    const paket = document.querySelector('input[name="jasaPaket"]:checked').value;
    const biaya = paket === 'vip' ? CONFIG.TARIF_JASA_SURVEI.VIP : CONFIG.TARIF_JASA_SURVEI.REGULER;

    const data = {
      nama_pemesan: document.getElementById('jasaNama').value,
      wa_pemesan: document.getElementById('jasaWA').value,
      sumber_aset: document.getElementById('jasaSumber').value,
      paket_jasa: paket,
      kabupaten_target: document.getElementById('jasaKabupaten').value,
      alamat_atau_link: document.getElementById('jasaAlamat').value,
      poin_cek_khusus: document.getElementById('jasaPoinCek').value,
      nominal_biaya_jasa: biaya,
      bukti_transfer_url: buktiUrl,
    };

    await submitJasaSurvei(data);

    closeModal('modalJasaSurvei');
    e.target.reset();
    showToast('Pesanan Jasa Wakili Survei berhasil dikirim! Admin akan memverifikasi penugasan surveyor.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengirim pesanan jasa survei.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Pesanan Jasa Survei';
  }
}

// ============================================================
// TITIP JUAL / SEWA ASET
// ============================================================
async function submitTitipJualForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

  try {
    const fotoFile = document.getElementById('titipFotoFile').files[0];
    let fotoUrl = '';
    if (fotoFile) {
      fotoUrl = await uploadToCloudinary(fotoFile, CONFIG.CLOUDINARY_FOLDERS.BUKTI_PEMBAYARAN);
    }

    const data = {
      nama_pemilik: document.getElementById('titipNama').value,
      wa_pemilik: document.getElementById('titipWA').value,
      jenis_aset: document.getElementById('titipJenis').value,
      kategori: document.getElementById('titipKategori').value,
      deskripsi_aset: document.getElementById('titipDeskripsi').value,
      lokasi: document.getElementById('titipLokasi').value,
      kabupaten: document.getElementById('titipKabupaten').value,
      harga_harapan: document.getElementById('titipHarga').value ? parseInt(document.getElementById('titipHarga').value) : null,
      foto_url: fotoUrl,
    };

    await submitTitipAset(data);

    closeModal('modalTitipJual');
    e.target.reset();
    showToast('Pengajuan titip aset berhasil dikirim! Tim surveyor kami akan menghubungi Anda.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengirim pengajuan titip aset.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Pengajuan Titip Aset';
  }
}

// ============================================================
// SAYEMBARA PENCARIAN
// ============================================================
async function loadSayembara() {
  try {
    const data = await fetchActiveSayembara();
    const grid = document.getElementById('sayembaraGrid');
    const empty = document.getElementById('sayembaraEmpty');
    if (!grid) return;

    if (!data || data.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    grid.innerHTML = data.map(item => `
      <div class="bg-slate-900 rounded-2xl p-5 border border-slate-700 shadow-lg flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-3">
            <span class="bg-gold/20 text-gold text-xs px-2.5 py-1 rounded font-mono font-bold">${item.kode_pencarian}</span>
            <span class="text-xs text-slate-400 font-semibold uppercase">${item.kategori}</span>
          </div>
          <p class="text-white text-sm font-semibold mb-2 leading-relaxed">${item.kriteria_spesifik}</p>
          <div class="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <i class="fas fa-map-marker-alt text-amber-400"></i> ${item.wilayah_target}
          </div>
          ${item.budget_maksimal ? `<p class="text-gold font-bold text-sm mb-4">Budget: ${formatRupiah(item.budget_maksimal)}</p>` : ''}
        </div>
        <button onclick="openLaporSayembara('${item.id}', '${item.kode_pencarian} - ${item.kriteria_spesifik.substring(0, 40)}')" class="btn-gold w-full py-2.5 rounded-xl text-xs font-bold">
          <i class="fas fa-flag mr-1"></i>Laporkan Aset Cocok
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading sayembara:', err);
  }
}

function openLaporSayembara(sayembaraId, title) {
  document.getElementById('laporSayembaraId').value = sayembaraId;
  document.getElementById('laporSayembaraTitle').textContent = title;
  openModal('modalLaporSayembara');
}

async function submitLaporanSayembaraForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';

  try {
    const data = {
      sayembara_id: document.getElementById('laporSayembaraId').value,
      nama_pelapor: document.getElementById('laporNama').value,
      wa_pelapor: document.getElementById('laporWA').value,
      deskripsi_aset: document.getElementById('laporDeskripsi').value,
      lokasi_aset: document.getElementById('laporLokasi').value,
    };

    await submitLaporanSayembara(data);

    closeModal('modalLaporSayembara');
    e.target.reset();
    showToast('Laporan sayembara berhasil dikirim! Admin akan menghubungi Anda jika aset cocok.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengirim laporan sayembara.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Laporan Sayembara';
  }
}

// ============================================================
// UI HELPERS (MODALS, TOAST, PREVIEW)
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('hidden');
}

function previewUpload(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.add('hidden');
  }
});

// ============================================================
// WIDGET SAYEMBARA CARI ASET (TITIP CARI PEMBELI SIAP CASH)
// ============================================================
async function submitSayembaraPembeli(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitBuyerRequest');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mendaftarkan Pencarian...';
  }

  try {
    const nama = document.getElementById('buyerNama')?.value.trim();
    const wa = document.getElementById('buyerWA')?.value.trim();
    const sektor = document.getElementById('buyerSektor')?.value;
    const wilayah = document.getElementById('buyerWilayah')?.value;
    const budget = document.getElementById('buyerBudget')?.value;
    const kriteria = document.getElementById('buyerKriteria')?.value.trim();

    const requestData = {
      id: 'REQ-BUYER-' + Date.now().toString().slice(-6),
      nama_pemesan: nama,
      kontak_pemesan: wa,
      sektor_dicari: sektor,
      wilayah_prioritas: wilayah,
      budget_range: budget,
      kriteria_khusus: kriteria || '-',
      status: 'Menunggu Tim Agen',
      created_at: new Date().toISOString()
    };

    // Simpan ke database / localStorage sayembara
    try {
      const stored = JSON.parse(localStorage.getItem('tabagsel_sayembara_requests') || '[]');
      stored.unshift(requestData);
      localStorage.setItem('tabagsel_sayembara_requests', JSON.stringify(stored));
    } catch (err) {}

    // Format WhatsApp otomatis ke Admin Kota Tabagsel Hub
    const targetWA = (window.CONFIG && CONFIG.WA_ADMIN && CONFIG.WA_ADMIN.PADANGSIDIMPUAN) ? CONFIG.WA_ADMIN.PADANGSIDIMPUAN : '62811646646';
    const pesanWA = 
`*SAYEMBARA PENCARIAN ASET (PEMBELI SIAP CASH)*
*TABAGSEL HUB - INTAKE PEMBELI*
--------------------------------------------------
• *Nama Pembeli:* ${nama}
• *WhatsApp:* ${wa}
• *Sektor Dicari:* ${sektor}
• *Wilayah Prioritas:* ${wilayah}
• *Rentang Budget Tunai:* ${budget}
• *Kriteria Khusus:*
"${kriteria || 'Sesuai rekomendasi terbaik tim agen'}"
--------------------------------------------------
_Halo Admin Tabagsel Hub, saya memiliki budget cash dan sedang mencari unit sesuai kriteria di atas. Mohon bantu carikan unit terverifikasi langsung ke tangan pertama._`;

    showToast('Permintaan pencarian aset berhasil dikirim!', 'success');
    document.getElementById('formSayembaraPembeli')?.reset();

    const waUrl = `https://wa.me/${targetWA}?text=${encodeURIComponent(pesanWA)}`;
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 800);
  } catch (error) {
    console.error('Error submitting buyer request:', error);
    showToast('Gagal mengirim: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

// ============================================================
// POPUP OTOMATIS: LAYANAN TITIP JUAL / KELOLA ASET KILAT
// ============================================================
function initPopupTitipJual() {
  const btnWA = document.getElementById('btnPopupChatWA');
  if (btnWA) {
    const targetWA = (window.CONFIG && CONFIG.WA_ADMIN && CONFIG.WA_ADMIN.PADANGSIDIMPUAN) ? CONFIG.WA_ADMIN.PADANGSIDIMPUAN : '62811646646';
    const textWA = 'Halo Admin Tabagsel Hub, saya pemilik aset dan ingin konsultasi titip jual/sewa aset bebas calo.';
    btnWA.href = `https://wa.me/${targetWA}?text=${encodeURIComponent(textWA)}`;
  }

  // Cek apakah sudah pernah dilihat dalam sesi ini
  if (sessionStorage.getItem('tabagsel_popup_titip_shown')) return;

  // Tampilkan otomatis setelah 5 detik
  setTimeout(() => {
    const anyActiveModal = document.querySelector('.modal-overlay.active');
    if (!anyActiveModal) {
      openModal('modalPopupTitipJual');
      sessionStorage.setItem('tabagsel_popup_titip_shown', 'true');
    }
  }, 5000);
}

function bukaTitipJualDariPopup() {
  closeModal('modalPopupTitipJual');
  setTimeout(() => {
    openModal('modalTitipJual');
  }, 350);
}
