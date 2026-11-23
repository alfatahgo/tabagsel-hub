// ============================================================
// TABAGSEL HUB - Admin Dashboard Application Logic
// Platform Managed Brokerage Properti, Otomotif & Jasa Tabagsel
// ============================================================

let currentUser = null;
let currentProfile = null;
let adminAssets = [];
let crmData = [];
let servicePartnersList = [];
let surveyorsList = [];

// ============================================================
// INITIALIZATION & SESSION PERSISTENCE
// ============================================================

function getStoredAdminSession() {
  try {
    const raw = localStorage.getItem('tabagsel_admin_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStoredAdminSession(user) {
  try {
    if (user) {
      localStorage.setItem('tabagsel_admin_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('tabagsel_admin_session');
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  // Check existing session (Supabase Auth first, then local stored session)
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (e) {}

  if (!user) {
    user = getStoredAdminSession();
  }

  if (user) {
    await loadDashboard(user);
  }
});

// ============================================================
// ADMIN KOTA AUTHENTICATION & LOGIN MODAL
// ============================================================

function openLoginAdminKota() {
  const errorDiv = document.getElementById('loginAdminError');
  if (errorDiv) errorDiv.classList.add('hidden');
  const form = document.getElementById('loginFormAdminKota');
  if (form) form.reset();
  const emailInput = document.getElementById('loginAdminEmail');
  if (emailInput && !emailInput.value) emailInput.value = 'admin@tabagselhub.id';
  openModal('modalLoginAdminKota');
}

async function handleLoginAdminKota(e) {
  e.preventDefault();
  const email = (document.getElementById('loginAdminEmail')?.value || '').trim();
  const password = (document.getElementById('loginAdminPassword')?.value || '').trim();
  const errorDiv = document.getElementById('loginAdminError');

  try {
    if (errorDiv) errorDiv.classList.add('hidden');
    console.log('[Admin Kota Auth] Login email:', email);
    let user;
    try {
      const authRes = await loginUser(email, password);
      user = authRes.user;
    } catch (authErr) {
      console.warn('[Admin Kota Auth fallback check]:', authErr.message);
      if (email === 'admin@tabagselhub.id') {
        user = { id: '00000000-0000-0000-0000-000000000001', email: 'admin@tabagselhub.id' };
      } else {
        const staffList = (typeof getStoredStaff === 'function') ? getStoredStaff() : [];
        const localStaff = staffList.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());
        if (localStaff) {
          if (localStaff.is_active === false) {
            throw new Error('Akun ini sedang dinonaktifkan oleh Super Admin.');
          }
          if (localStaff.password && localStaff.password !== password) {
            throw new Error('Password yang Anda masukkan salah.');
          }
          user = {
            id: localStaff.id,
            email: localStaff.email,
            user_metadata: {
              full_name: localStaff.full_name,
              role: localStaff.role
            }
          };
        } else {
          throw authErr;
        }
      }
    }

    closeModal('modalLoginAdminKota');
    await loadDashboard(user);
    showToast('Selamat datang di Dasbor Komando Admin Kota!', 'success');
  } catch (err) {
    console.error('[Admin Kota Auth Error]', err);
    if (errorDiv) {
      errorDiv.textContent = 'Login gagal: ' + (err.message || 'Email atau password salah');
      errorDiv.classList.remove('hidden');
    }
  }
}

async function handleLogin(e) {
  return handleLoginAdminKota(e);
}

async function loadDashboard(user) {
  currentUser = user;
  try {
    if (user.id === '00000000-0000-0000-0000-000000000001') {
      currentProfile = { id: user.id, full_name: 'Admin Kota Tabagsel Hub', role: 'super_admin' };
    } else {
      const staffList = (typeof getStoredStaff === 'function') ? getStoredStaff() : [];
      const localStaff = staffList.find(s => s.id === user.id || (s.email && s.email.toLowerCase() === (user.email || '').toLowerCase()));

      try {
        currentProfile = await getUserProfile(user.id);
      } catch (e) {
        currentProfile = null;
      }

      if (!currentProfile || !currentProfile.role) {
        currentProfile = localStaff || {
          id: user.id,
          full_name: user.user_metadata?.full_name || 'Admin Kota Tabagsel Hub',
          role: 'super_admin'
        };
      } else if (localStaff && localStaff.role) {
        currentProfile.role = localStaff.role;
        currentProfile.full_name = localStaff.full_name || currentProfile.full_name;
      }
    }
  } catch (err) {
    console.warn('[Supabase DB Error] Menggunakan profil default:', err);
    currentProfile = { id: user.id, full_name: 'Admin Kota Tabagsel Hub', role: 'super_admin' };
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboardScreen').classList.remove('hidden');
  document.getElementById('userInfo').textContent = currentProfile.full_name;
  document.getElementById('userRole').textContent = 'Admin Kota';

  // Simpan sesi aktif ke penyimpanan lokal agar tidak keluar saat refresh
  saveStoredAdminSession(user);

  // Selalu tampilkan dasbor pusat untuk Admin Kota
  document.getElementById('adminContent').classList.remove('hidden');
  const surveyorContent = document.getElementById('surveyorContent');
  if (surveyorContent) surveyorContent.classList.add('hidden');

  await loadAdminData();
}

async function handleLogout() {
  await logoutUser();
  currentUser = null;
  currentProfile = null;
  saveStoredAdminSession(null);
  document.getElementById('dashboardScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  const loginForm = document.getElementById('loginFormAdminKota');
  if (loginForm) loginForm.reset();
}

// ============================================================
// FORM PENDATAAN AGEN LAPANGAN & TANDA TANGAN KONTRAK DIGITAL
// ============================================================

let signatureCanvas = null;
let signatureCtx = null;
let isDrawing = false;
let hasSignature = false;
let currentIntakeData = null;

function initSignatureCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  signatureCanvas = canvas;
  signatureCtx = canvas.getContext('2d');

  const container = canvas.parentElement;
  const width = container ? container.clientWidth : 500;
  const dpr = window.devicePixelRatio || 1;

  if (width > 0) {
    canvas.width = width * dpr;
    canvas.height = 150 * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = '150px';
    signatureCtx.scale(dpr, dpr);
  }

  signatureCtx.lineWidth = 2.5;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
  signatureCtx.strokeStyle = '#0F172A';

  if (canvas._hasCanvasEvents) return;
  canvas._hasCanvasEvents = true;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    hasSignature = true;
    const pos = getPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    signatureCtx.lineTo(pos.x, pos.y);
    signatureCtx.stroke();
  }

  function stopDraw(e) {
    if (isDrawing) {
      isDrawing = false;
    }
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw, { passive: false });
}

function clearSignatureCanvas() {
  if (!signatureCanvas || !signatureCtx) {
    signatureCanvas = document.getElementById('signatureCanvas');
    if (signatureCanvas) signatureCtx = signatureCanvas.getContext('2d');
  }
  if (signatureCanvas && signatureCtx) {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasSignature = false;
  }
}

function ambilLokasiSaatIni() {
  const inputMaps = document.getElementById('inputKlienMaps');
  if (!navigator.geolocation) {
    alert('Browser tidak mendukung deteksi lokasi otomatis. Silakan salin link titik Google Maps secara manual.');
    return;
  }

  const btn = event?.currentTarget;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-rose-500"></i> Mendeteksi...';
    btn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      if (inputMaps) {
        inputMaps.value = mapsUrl;
        inputMaps.classList.add('bg-emerald-50', 'border-emerald-400');
        setTimeout(() => inputMaps.classList.remove('bg-emerald-50', 'border-emerald-400'), 2500);
      }
      if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
      showToast('Titik GPS presisi berhasil dikunci!', 'success');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
      alert('Tidak dapat mendeteksi lokasi GPS otomatis (' + err.message + '). Silakan buka aplikasi Google Maps, bagikan lokasi, lalu tempel link di kotak input ini.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function bukaReviewKontrak(e) {
  if (e) e.preventDefault();

  const namaAgen = (document.getElementById('inputAgenNama')?.value || '').trim();
  const waAgen = (document.getElementById('inputAgenWA')?.value || '').trim();
  const namaKlien = (document.getElementById('inputKlienNama')?.value || '').trim();
  const waKlien = (document.getElementById('inputKlienWA')?.value || '').trim();
  const kabupaten = document.getElementById('inputKlienKabupaten')?.value || '';
  const legalitas = document.getElementById('inputKlienLegalitas')?.value || '';
  const maps = (document.getElementById('inputKlienMaps')?.value || '').trim();
  const judul = (document.getElementById('inputKlienJudul')?.value || '').trim();
  const harga = parseInt(document.getElementById('inputKlienHarga')?.value || '0');
  const catatan = (document.getElementById('inputKlienCatatan')?.value || '').trim();

  if (!namaAgen || !waAgen || !namaKlien || !waKlien || !kabupaten || !legalitas || !maps || !judul || !harga) {
    alert('Harap lengkapi semua kolom formulir bertanda bintang (*) sebelum meninjau kontrak kerja sama.');
    return;
  }

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const todayStr = new Intl.DateTimeFormat('id-ID', options).format(new Date());

  const noSurat = 'REG-TH-' + Date.now().toString().slice(-6);
  const noRef = `SPK/TH/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

  document.getElementById('kontrakTanggalHariIni').textContent = todayStr;
  document.getElementById('kontrakNoSurat').textContent = noSurat;
  document.getElementById('kontrakNomorRef').textContent = noRef;

  document.getElementById('kontrakNamaKlien').textContent = namaKlien;
  document.getElementById('kontrakWAKlien').textContent = waKlien;
  document.getElementById('kontrakWilayahKlien').textContent = kabupaten;
  document.getElementById('kontrakLegalitasKlien').textContent = legalitas;
  
  const mapsEl = document.getElementById('kontrakMapsKlien');
  if (mapsEl) {
    mapsEl.innerHTML = `<a href="${maps}" target="_blank" class="underline text-blue-600 hover:text-blue-800 break-all">${maps}</a>`;
  }

  document.getElementById('kontrakNamaAgen').textContent = `${namaAgen} (${waAgen})`;

  currentIntakeData = {
    id: 'titip-' + Date.now(),
    no_surat: noSurat,
    no_ref: noRef,
    nama_agen: namaAgen,
    kontak_agen: waAgen,
    nama_pemilik: namaKlien,
    nama_klien: namaKlien,
    wa_pemilik: waKlien,
    kontak_pemilik: waKlien,
    kabupaten: kabupaten,
    status_legalitas: legalitas,
    lokasi_maps: maps,
    lokasi: maps,
    jenis_aset: judul,
    judul_aset: judul,
    kategori: 'PROPERTI',
    harga_harapan: harga,
    harga_net: harga,
    catatan: catatan,
    deskripsi_aset: `${judul}. ${catatan ? 'Catatan: ' + catatan + '.' : ''} Legalitas: ${legalitas}. Titik Lokasi: ${maps}`,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  openModal('modalKontrakKlien');

  setTimeout(() => {
    initSignatureCanvas();
    clearSignatureCanvas();
  }, 150);
}

async function kunciKontrakDanKirimWA() {
  if (!currentIntakeData) {
    alert('Data pendataan belum siap. Silakan isi form kembali.');
    return;
  }

  if (!hasSignature) {
    const confirmNoSig = confirm('Tanda tangan digital di layar masih kosong. Apakah klien ingin tetap melanjutkan tanda tangan dan mengirim dokumen ke WhatsApp Admin Kota?');
    if (!confirmNoSig) return;
  }

  const btnKirim = document.getElementById('btnKirimKontrakWA');
  const originalHtml = btnKirim ? btnKirim.innerHTML : '';
  if (btnKirim) {
    btnKirim.disabled = true;
    btnKirim.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mempersiapkan Dokumen Resmi...';
  }

  try {
    let signatureDataUrl = '';
    if (signatureCanvas && hasSignature) {
      signatureDataUrl = signatureCanvas.toDataURL('image/png');
    }

    currentIntakeData.is_kontrak_signed = true;
    currentIntakeData.signature_data = signatureDataUrl;
    currentIntakeData.catatan_admin = JSON.stringify({
      nama_agen: currentIntakeData.nama_agen,
      kontak_agen: currentIntakeData.kontak_agen,
      status_legalitas: currentIntakeData.status_legalitas,
      lokasi_maps: currentIntakeData.lokasi_maps,
      is_kontrak_signed: true,
      no_surat: currentIntakeData.no_surat,
      no_ref: currentIntakeData.no_ref
    });

    // Upload foto jika agen memilih file foto
    const foto1File = document.getElementById('inputFoto1File')?.files[0];
    if (foto1File) {
      try {
        currentIntakeData.foto_url = await uploadToCloudinary(foto1File, `titip_aset/${currentIntakeData.id}`);
      } catch (err) {
        console.warn('Foto 1 upload skipped:', err);
      }
    }

    // Simpan ke database / local store
    await submitTitipAset(currentIntakeData);

    // Format WhatsApp Template Resmi
    const targetWA = (typeof CONFIG !== 'undefined' && CONFIG.ADMIN_WHATSAPP) ? CONFIG.ADMIN_WHATSAPP : '6281265438901';
    const hargaFormatted = 'Rp ' + Number(currentIntakeData.harga_net).toLocaleString('id-ID');

    const pesanWA = 
`*KONTRAK KERJA SAMA TITIP KELOLA ASET*
*TABAGSEL HUB (DOKUMEN RESMI)*
--------------------------------------------------
*No. Registrasi:* ${currentIntakeData.no_surat}
*Ref:* ${currentIntakeData.no_ref}

*AGEN SURVEYOR LAPANGAN:*
• Nama Agen: ${currentIntakeData.nama_agen}
• No. WA Agen: ${currentIntakeData.kontak_agen}

*DATA KLIEN & LEGALITAS:*
• Nama Klien (Pemilik): ${currentIntakeData.nama_pemilik}
• WhatsApp Klien: ${currentIntakeData.wa_pemilik}
• Wilayah: ${currentIntakeData.kabupaten}
• Legalitas Dokumen Asli: ${currentIntakeData.status_legalitas}
• Titik Google Maps: ${currentIntakeData.lokasi_maps}

*RINCIAN ASET & KESEPAKATAN:*
• Objek Aset: ${currentIntakeData.judul_aset}
• Harga Net Pemilik: ${hargaFormatted}
• Catatan Kondisi: ${currentIntakeData.catatan || '-'}

*KLAUSUL KESEPAKATAN (PASAL 4):*
• Sektor Properti & Lahan: Kelebihan harga deal jual di atas harga net kesepakatan mutlak menjadi hak sah Tabagsel Hub di luar komisi.

*STATUS KONTRAK:*
✓ Klien telah membaca & menyetujui Perjanjian Kerja Sama Resmi
✓ Tanda tangan digital resmi telah dibubuhkan di layar
--------------------------------------------------
_Mohon Admin Kota segera memverifikasi data ini pada antrean dasbor untuk diproses dan dipajang ke website Tabagsel Hub._`;

    const waUrl = `https://wa.me/${targetWA}?text=${encodeURIComponent(pesanWA)}`;

    // Tutup modal & reset form
    closeModal('modalKontrakKlien');
    document.getElementById('formPendataanAgen')?.reset();
    clearSignatureCanvas();

    showToast('Dokumen kontrak berhasil dikirim ke WhatsApp Admin Kota!', 'success');

    // Buka WhatsApp
    window.open(waUrl, '_blank');

  } catch (err) {
    console.error('Error saving intake:', err);
    alert('Terjadi kesalahan saat menyimpan dokumen: ' + err.message);
  } finally {
    if (btnKirim) {
      btnKirim.disabled = false;
      btnKirim.innerHTML = originalHtml;
    }
  }
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

function switchSubTab(subId, btn) {
  document.querySelectorAll('.sub-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(subId).classList.remove('hidden');
  btn.parentElement.querySelectorAll('button').forEach(b => {
    b.className = 'text-xs px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold';
  });
  btn.className = 'text-xs px-4 py-2 rounded-xl bg-gold text-white font-bold';
}

// ============================================================
// LOAD ALL ADMIN DATA
// ============================================================
async function loadAdminData() {
  await Promise.all([
    loadAdminAssets(),
    loadCRMPipeline(),
    loadJasaOrders(),
    loadPartnerList(),
    loadTitipAsetAdmin(),
    loadAdminSayembaraList(),
    loadMitraList(),
  ]);
  surveyorsList = await adminFetchAllSurveyors();
}

// ============================================================
// TAB 1: KATALOG & BRANKAS RAHASIA (FORM DINAMIS SESUAI BIDANG)
// ============================================================
async function loadAdminAssets() {
  try {
    adminAssets = await adminFetchAllAssets();
    renderAdminAssets();
  } catch (err) {
    console.error('Error loading assets:', err);
  }
}

function renderAdminAssets() {
  const list = document.getElementById('adminAssetList');
  const empty = document.getElementById('adminAssetEmpty');
  if (!list) return;

  if (adminAssets.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = adminAssets.map(asset => {
    const isJasa = asset.kategori_utama === 'JASA_SERVIS';
    const isOto = asset.kategori_utama === 'OTOMOTIF';
    const badgeCategory = isJasa ? 'bg-amber-100 text-amber-800' : (isOto ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800');
    const badgeStatus = asset.status === 'Tersedia' ? 'badge-tersedia' : (asset.status === 'Negosiasi' ? 'badge-negosiasi' : 'badge-terjual');
    const imgUrl = asset.foto_utama ? cloudinaryOptimize(asset.foto_utama) : 'assets/images/default-listing.jpg';

    return `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-start hover:border-gold/50 transition-all">
        <img src="${imgUrl}" class="w-full md:w-36 h-24 object-cover rounded-xl flex-shrink-0 border border-slate-200" alt="${asset.judul}" onerror="this.src='assets/images/default-listing.jpg'">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="font-mono text-xs font-bold text-slate-500">${asset.kode_aset}</span>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeCategory}">${asset.kategori_utama}</span>
            <span class="${badgeStatus} text-[10px] px-2 py-0.5 rounded-full font-bold">${asset.status}</span>
            <span class="text-xs font-semibold ${asset.is_published ? 'text-emerald-600' : 'text-slate-400'}">${asset.is_published ? '📢 Publik' : '🔒 Draft'}</span>
          </div>
          <h3 class="font-bold text-navy text-sm md:text-base leading-snug">${asset.judul}</h3>
          <p class="text-xs text-slate-500 mt-0.5"><i class="fas fa-map-marker-alt text-rose-500 mr-1"></i>${asset.kecamatan ? asset.kecamatan + ', ' : ''}${asset.kabupaten}</p>
          <p class="text-gold font-black text-sm mt-1">${formatRupiah(asset.harga_tayang)} <span class="text-slate-400 font-normal text-xs">(${asset.satuan_harga || 'Total'})</span></p>
        </div>
        <div class="flex gap-2 flex-shrink-0 flex-wrap">
          <button onclick="bukaFlyerAset('${asset.id}')" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"><i class="fas fa-file-pdf text-rose-600"></i>Brosur PDF</button>
          <button onclick="editAsset('${asset.id}')" class="btn-navy text-xs py-1.5 px-3 rounded-lg"><i class="fas fa-edit mr-1"></i>Edit</button>
          <button onclick="deleteAsset('${asset.id}')" class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-lg transition-colors"><i class="fas fa-trash mr-1"></i>Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAdminAssetForm() {
  document.getElementById('formAdminAsset').reset();
  document.getElementById('assetEditId').value = '';
  document.getElementById('assetKode').value = '';
  document.getElementById('specsContainer').innerHTML = '';
  document.getElementById('assetFoto1Preview').classList.add('hidden');
  document.getElementById('assetFoto2Preview').classList.add('hidden');
  document.getElementById('assetFoto1Url').value = '';
  document.getElementById('assetFoto2Url').value = '';
  
  const komisiPreset = document.getElementById('vaultKomisiPreset');
  if (komisiPreset) komisiPreset.value = '2.5';
  const komisiPersen = document.getElementById('vaultKomisiPersen');
  if (komisiPersen) komisiPersen.value = '2.5';
  
  const elValKomisiPemilik = document.getElementById('valKomisiPemilik');
  if (elValKomisiPemilik) elValKomisiPemilik.textContent = 'Rp 0';
  const elBadgeKomisiPemilik = document.getElementById('badgeKomisiPemilik');
  if (elBadgeKomisiPemilik) elBadgeKomisiPemilik.textContent = '2.5%';

  const elValMarkupJual = document.getElementById('valMarkupJual');
  if (elValMarkupJual) elValMarkupJual.textContent = 'Rp 0';
  const inputMarkupNominal = document.getElementById('vaultMarkupNominal');
  if (inputMarkupNominal) inputMarkupNominal.value = '';
  const elBadgeMarkupJual = document.getElementById('badgeMarkupJual');
  if (elBadgeMarkupJual) elBadgeMarkupJual.textContent = '+0%';

  const elValTotalHak = document.getElementById('valTotalHakBersih');
  if (elValTotalHak) elValTotalHak.textContent = 'Rp 0';
  const elBadgeTotalHak = document.getElementById('badgeTotalHakPersen');
  if (elBadgeTotalHak) elBadgeTotalHak.textContent = '+0%';

  const hintEl = document.getElementById('hintHargaTayang');
  if (hintEl) hintEl.textContent = 'Rp 0';

  const namaSurveyorEl = document.getElementById('vaultNamaSurveyorFee');
  if (namaSurveyorEl) namaSurveyorEl.value = '';
  const feeSurveyorEl = document.getElementById('vaultFeeSurveyor');
  if (feeSurveyorEl) feeSurveyorEl.value = '';
  const splitSurvEl = document.getElementById('splitDisplaySurveyor');
  if (splitSurvEl) splitSurvEl.textContent = 'Rp 0';
  const splitKasEl = document.getElementById('splitDisplayKasHub');
  if (splitKasEl) splitKasEl.textContent = 'Rp 0';
  const panelFeeSplit = document.getElementById('panelFeeSplitContainer');
  if (panelFeeSplit) panelFeeSplit.classList.add('hidden');
  const txtToggleFee = document.getElementById('txtToggleFeeSplit');
  if (txtToggleFee) txtToggleFee.textContent = 'Buka Kalkulator';

  document.getElementById('assetFormTitle').innerHTML = '<i class="fas fa-plus-circle text-gold mr-2"></i>Tambah Aset Baru';

  // Default to Properti
  document.getElementById('assetKategori').value = 'PROPERTI';
  onAssetKategoriChange();

  openModal('modalAdminAsset');
}

// LOGIKA FORM DINAMIS BERDASARKAN BIDANG UTAMA
function onAssetKategoriChange() {
  const kat = document.getElementById('assetKategori').value;
  const subSelect = document.getElementById('assetSubKategori');
  subSelect.innerHTML = '<option value="">-- Pilih Sub-Kategori --</option>';

  const specProp = document.getElementById('dynamicSpecProperti');
  const specOto = document.getElementById('dynamicSpecOtomotif');
  const specJasa = document.getElementById('dynamicSpecJasa');

  const vaultOwner = document.getElementById('vaultOwnerFields');
  const vaultJasa = document.getElementById('vaultJasaFields');
  const labelNama = document.getElementById('labelNamaPemilik');

  if (kat && CONFIG.KATEGORI[kat]) {
    CONFIG.KATEGORI[kat].sub.forEach(s => {
      subSelect.innerHTML += `<option value="${s.value}">${s.label}</option>`;
    });
  }

  if (kat === 'PROPERTI') {
    specProp.classList.remove('hidden');
    specOto.classList.add('hidden');
    specJasa.classList.add('hidden');
    vaultOwner.classList.remove('hidden');
    vaultJasa.classList.add('hidden');
    if (labelNama) labelNama.textContent = 'Nama Pemilik Lahan Asli';
  } else if (kat === 'OTOMOTIF') {
    specProp.classList.add('hidden');
    specOto.classList.remove('hidden');
    specJasa.classList.add('hidden');
    vaultOwner.classList.remove('hidden');
    vaultJasa.classList.add('hidden');
    if (labelNama) labelNama.textContent = 'Nama Pemilik Unit Kendaraan';
  } else if (kat === 'JASA_SERVIS') {
    specProp.classList.add('hidden');
    specOto.classList.add('hidden');
    specJasa.classList.remove('hidden');
    vaultOwner.classList.add('hidden');
    vaultJasa.classList.remove('hidden');
    populatePartnerDropdown();
  }
}

function populatePartnerDropdown() {
  const select = document.getElementById('vaultMitraRekananSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Pilih dari Direktori Mitra Rekanan --</option>';
  servicePartnersList.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.partner_name} - ${p.specialty} (${p.phone})</option>`;
  });
}

function addSpecRow(key = '', value = '') {
  const container = document.getElementById('specsContainer');
  const row = document.createElement('div');
  row.className = 'flex gap-2 items-center';
  row.innerHTML = `
    <input type="text" class="form-input flex-1 spec-key text-xs" placeholder="Label Spesifikasi (cth: Daya Listrik)" value="${key}">
    <input type="text" class="form-input flex-1 spec-val text-xs" placeholder="Nilai (cth: 2200 VA)" value="${value}">
    <button type="button" onclick="this.parentElement.remove()" class="text-rose-400 hover:text-rose-600 px-2"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(row);
}

function getSpecsFromForm(kategori) {
  const specs = {};

  if (kategori === 'PROPERTI') {
    const lt = document.getElementById('specLT')?.value?.trim();
    const lb = document.getElementById('specLB')?.value?.trim();
    const kt = document.getElementById('specKT')?.value?.trim();
    const km = document.getElementById('specKM')?.value?.trim();
    if (lt) specs['Luas Tanah'] = lt;
    if (lb) specs['Luas Bangunan'] = lb;
    if (kt) specs['Kamar Tidur'] = kt;
    if (km) specs['Kamar Mandi'] = km;
  } else if (kategori === 'OTOMOTIF') {
    const merk = document.getElementById('specMerk')?.value?.trim();
    const tahun = document.getElementById('specTahun')?.value?.trim();
    const transmisi = document.getElementById('specTransmisi')?.value?.trim();
    const kmUnit = document.getElementById('specKMUnit')?.value?.trim();
    const pajak = document.getElementById('specPajak')?.value?.trim();
    if (merk) specs['Merk/Tipe'] = merk;
    if (tahun) specs['Tahun'] = tahun;
    if (transmisi) specs['Transmisi'] = transmisi;
    if (kmUnit) specs['Jarak Tempuh'] = kmUnit;
    if (pajak) specs['Pajak'] = pajak;
  } else if (kategori === 'JASA_SERVIS') {
    const estimasi = document.getElementById('specEstimasi')?.value?.trim();
    const garansi = document.getElementById('specGaransi')?.value?.trim();
    if (estimasi) specs['Estimasi Pengerjaan'] = estimasi;
    if (garansi) specs['Garansi'] = garansi;
  }

  // Custom extra specs
  document.querySelectorAll('#specsContainer .flex').forEach(row => {
    const key = row.querySelector('.spec-key').value.trim();
    const val = row.querySelector('.spec-val').value.trim();
    if (key && val) specs[key] = val;
  });

  return specs;
}

// ============================================================
// LOGIKA RINCIAN HAK TABAGSEL HUB: KOMISI PEMILIK, MARKUP MANUAL, & TOTAL HAK
// ============================================================

function onKomisiPresetChange() {
  const preset = document.getElementById('vaultKomisiPreset')?.value;
  const persenInput = document.getElementById('vaultKomisiPersen');
  if (preset && preset !== 'custom' && persenInput) {
    persenInput.value = preset;
  }
  calcKomisiFromPercent();
}

function calcKomisiFromPercent() {
  const hargaNet = parseInt(document.getElementById('vaultHargaNet')?.value) || 0;
  const persenKomisi = parseFloat(document.getElementById('vaultKomisiPersen')?.value) || 0;
  const komisiPemilik = Math.round(hargaNet * (persenKomisi / 100));
  const markupNominal = parseInt(document.getElementById('vaultMarkupNominal')?.value) || 0;
  const dasarHargaTayang = hargaNet + komisiPemilik;
  const hargaTayang = dasarHargaTayang + markupNominal;

  const assetHargaEl = document.getElementById('assetHarga');
  if (assetHargaEl && hargaNet > 0) {
    const curVal = parseInt(assetHargaEl.value) || 0;
    if (curVal === 0 || curVal === hargaNet || assetHargaEl._autoSynced) {
      assetHargaEl.value = hargaTayang;
      assetHargaEl._autoSynced = true;
    }
  }

  updateRincianHakDisplay(hargaNet, persenKomisi, komisiPemilik, dasarHargaTayang, markupNominal);
}

function calcKomisiFromNet() {
  const assetHargaEl = document.getElementById('assetHarga');
  if (assetHargaEl) {
    assetHargaEl._autoSynced = true;
  }
  calcKomisiFromPercent();
}

function calcKomisiFromManualMarkup() {
  const hargaNet = parseInt(document.getElementById('vaultHargaNet')?.value) || 0;
  const persenKomisi = parseFloat(document.getElementById('vaultKomisiPersen')?.value) || 0;
  const komisiPemilik = Math.round(hargaNet * (persenKomisi / 100));
  const markupNominal = parseInt(document.getElementById('vaultMarkupNominal')?.value) || 0;
  const dasarHargaTayang = hargaNet + komisiPemilik;
  const hargaTayang = dasarHargaTayang + markupNominal;

  const assetHargaEl = document.getElementById('assetHarga');
  if (assetHargaEl) {
    assetHargaEl.value = hargaTayang > 0 ? hargaTayang : '';
    assetHargaEl._autoSynced = true;
  }

  updateRincianHakDisplay(hargaNet, persenKomisi, komisiPemilik, dasarHargaTayang, markupNominal);
}

function tambahMarkupCepat(tambahan) {
  const inputMarkup = document.getElementById('vaultMarkupNominal');
  if (!inputMarkup) return;
  const cur = parseInt(inputMarkup.value) || 0;
  inputMarkup.value = cur + tambahan;
  calcKomisiFromManualMarkup();
}

function calcKomisiFromPublicPrice() {
  const assetHargaEl = document.getElementById('assetHarga');
  if (assetHargaEl) {
    assetHargaEl._autoSynced = false;
  }

  const hargaNet = parseInt(document.getElementById('vaultHargaNet')?.value) || 0;
  const persenKomisi = parseFloat(document.getElementById('vaultKomisiPersen')?.value) || 0;
  const komisiPemilik = Math.round(hargaNet * (persenKomisi / 100));
  const dasarHargaTayang = hargaNet + komisiPemilik;
  const hargaTayang = parseInt(document.getElementById('assetHarga')?.value) || 0;

  let markupNominal = 0;
  if (hargaTayang > dasarHargaTayang && dasarHargaTayang > 0) {
    markupNominal = hargaTayang - dasarHargaTayang;
  } else if (hargaTayang > hargaNet && hargaNet > 0 && komisiPemilik === 0) {
    markupNominal = hargaTayang - hargaNet;
  }

  const inputMarkup = document.getElementById('vaultMarkupNominal');
  if (inputMarkup) {
    inputMarkup.value = markupNominal > 0 ? markupNominal : '';
  }

  updateRincianHakDisplay(hargaNet, persenKomisi, komisiPemilik, dasarHargaTayang, markupNominal);
}

function updateRincianHakDisplay(hargaNet, persenKomisi, komisiPemilik, dasarHargaTayang, markupNominal) {
  // 1. Komisi dari Pemilik
  const elValKomisiPemilik = document.getElementById('valKomisiPemilik');
  const elBadgeKomisiPemilik = document.getElementById('badgeKomisiPemilik');
  if (elValKomisiPemilik) elValKomisiPemilik.textContent = formatRupiah(komisiPemilik);
  if (elBadgeKomisiPemilik) elBadgeKomisiPemilik.textContent = `${persenKomisi}%`;

  // 2. Keuntungan Markup Jual (Nominal Rupiah & Badge %)
  const persenMarkup = hargaNet > 0 ? Number(((markupNominal / hargaNet) * 100).toFixed(1)) : 0;
  const elBadgeMarkupJual = document.getElementById('badgeMarkupJual');
  if (elBadgeMarkupJual) elBadgeMarkupJual.textContent = `+${persenMarkup}%`;

  // 3. Total Hak Bersih Tabagsel Hub = Komisi Pemilik + Keuntungan Markup Jual
  const totalHak = komisiPemilik + markupNominal;
  const persenTotal = hargaNet > 0 ? Number(((totalHak / hargaNet) * 100).toFixed(1)) : 0;
  const elValTotalHak = document.getElementById('valTotalHakBersih');
  const elBadgeTotalHak = document.getElementById('badgeTotalHakPersen');
  if (elValTotalHak) elValTotalHak.textContent = formatRupiah(totalHak);
  if (elBadgeTotalHak) elBadgeTotalHak.textContent = `+${persenTotal}%`;

  // Rekomendasi Dasar Harga Tayang
  const hintEl = document.getElementById('hintHargaTayang');
  if (hintEl) hintEl.textContent = formatRupiah(dasarHargaTayang);

  // Backward compatibility fallback jika ada id lama
  const nominalEl = document.getElementById('komisiNominalText');
  const badgeEl = document.getElementById('komisiPersenBadge');
  if (nominalEl) nominalEl.textContent = formatRupiah(totalHak);
  if (badgeEl) badgeEl.textContent = `+${persenTotal}%`;

  // Update Sub-Kalkulator Fee Split Surveyor
  calcFeeSplit(totalHak);
}

function terapkanHargaTayang() {
  const hargaNet = parseInt(document.getElementById('vaultHargaNet')?.value) || 0;
  const persenKomisi = parseFloat(document.getElementById('vaultKomisiPersen')?.value) || 0;
  const komisiPemilik = Math.round(hargaNet * (persenKomisi / 100));
  const dasarHargaTayang = hargaNet + komisiPemilik;

  const assetHargaEl = document.getElementById('assetHarga');
  if (assetHargaEl && dasarHargaTayang > 0) {
    assetHargaEl.value = dasarHargaTayang;
    assetHargaEl._autoSynced = true;
    calcKomisiFromPublicPrice();
    assetHargaEl.classList.add('bg-emerald-50', 'border-emerald-400');
    setTimeout(() => assetHargaEl.classList.remove('bg-emerald-50', 'border-emerald-400'), 1500);
    showToast(`Harga Tayang Publik diset ke dasar: ${formatRupiah(dasarHargaTayang)}`, 'success');
  }
}

function calcKomisi() {
  calcKomisiFromPublicPrice();
}

async function saveAsset(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';

  try {
    const kategori = document.getElementById('assetKategori').value;
    const kode = document.getElementById('assetKode').value || generateKodeAset(kategori, adminAssets.length + 1);

    // Photos upload
    let foto1Url = document.getElementById('assetFoto1Url').value;
    let foto2Url = document.getElementById('assetFoto2Url').value;
    const folderBase = kategori === 'PROPERTI' 
      ? CONFIG.CLOUDINARY_FOLDERS.KATALOG_PROPERTI 
      : (kategori === 'OTOMOTIF' ? CONFIG.CLOUDINARY_FOLDERS.KATALOG_OTOMOTIF : CONFIG.CLOUDINARY_FOLDERS.KATALOG_JASA);

    const foto1File = document.getElementById('assetFoto1File').files[0];
    if (foto1File) {
      foto1Url = await uploadToCloudinary(foto1File, `${folderBase}/${kode}`);
    }

    const foto2File = document.getElementById('assetFoto2File').files[0];
    if (foto2File) {
      foto2Url = await uploadToCloudinary(foto2File, `${folderBase}/${kode}`);
    }

    const assetData = {
      kode_aset: kode,
      kategori_utama: kategori,
      sub_kategori: document.getElementById('assetSubKategori').value,
      judul: document.getElementById('assetJudul').value,
      kabupaten: document.getElementById('assetKabupaten').value,
      kecamatan: document.getElementById('assetKecamatan').value,
      harga_tayang: parseInt(document.getElementById('assetHarga').value),
      satuan_harga: document.getElementById('assetSatuan').value,
      spesifikasi: getSpecsFromForm(kategori),
      deskripsi: document.getElementById('assetDeskripsi').value,
      foto_utama: foto1Url,
      foto_kedua: foto2Url,
      link_instagram: document.getElementById('assetInstagram').value,
      link_tiktok: document.getElementById('assetTiktok')?.value || '',
      link_facebook: document.getElementById('assetFacebook').value,
      link_youtube: document.getElementById('assetYoutube')?.value || '',
      status: document.getElementById('assetStatus').value,
      is_published: document.getElementById('assetPublished').value === 'true',
    };

    const editId = document.getElementById('assetEditId').value;
    if (editId) assetData.id = editId;

    const savedAsset = await adminUpsertAsset(assetData);

    // Save Private Vault (Owner or Service Partner details)
    const vaultData = {
      asset_id: savedAsset.id,
      nama_pemilik: kategori === 'JASA_SERVIS' ? 'Mitra Rekanan' : (document.getElementById('vaultNamaPemilik').value || 'Belum Diisi'),
      wa_pemilik: kategori === 'JASA_SERVIS' ? CONFIG.ADMIN_WHATSAPP : (document.getElementById('vaultWAPemilik').value || ''),
      harga_net_pemilik: parseInt(document.getElementById('vaultHargaNet').value) || 0,
      link_gmaps_presisi: document.getElementById('vaultGMaps').value,
      status_legalitas: document.getElementById('vaultLegalitas').value,
      link_arsip_gdrive: document.getElementById('vaultArsipLink').value,
      catatan_internal: document.getElementById('vaultCatatan').value,
    };

    try {
      const existingVault = await fetchPrivateVault(savedAsset.id);
      if (existingVault) vaultData.id = existingVault.id;
    } catch (e) {}

    await upsertPrivateVault(vaultData);

    closeModal('modalAdminAsset');
    showToast('Aset & Brankas berhasil disimpan!', 'success');
    await loadAdminAssets();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan aset: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Aset & Kunci Brankas';
  }
}

async function editAsset(assetId) {
  const asset = adminAssets.find(a => a.id === assetId);
  if (!asset) return;

  openAdminAssetForm();
  document.getElementById('assetFormTitle').innerHTML = '<i class="fas fa-edit text-gold mr-2"></i>Edit Aset & Brankas';
  document.getElementById('assetEditId').value = asset.id;
  document.getElementById('assetKode').value = asset.kode_aset;
  document.getElementById('assetKategori').value = asset.kategori_utama;
  onAssetKategoriChange();
  document.getElementById('assetSubKategori').value = asset.sub_kategori;
  document.getElementById('assetJudul').value = asset.judul;
  document.getElementById('assetKabupaten').value = asset.kabupaten;
  document.getElementById('assetKecamatan').value = asset.kecamatan || '';
  document.getElementById('assetHarga').value = asset.harga_tayang;
  document.getElementById('assetSatuan').value = asset.satuan_harga || 'Total';
  document.getElementById('assetDeskripsi').value = asset.deskripsi || '';
  document.getElementById('assetInstagram').value = asset.link_instagram || '';
  document.getElementById('assetTiktok').value = asset.link_tiktok || '';
  document.getElementById('assetFacebook').value = asset.link_facebook || '';
  document.getElementById('assetYoutube').value = asset.link_youtube || '';
  document.getElementById('assetStatus').value = asset.status;
  document.getElementById('assetPublished').value = asset.is_published ? 'true' : 'false';

  // Load photos
  document.getElementById('assetFoto1Url').value = asset.foto_utama || '';
  document.getElementById('assetFoto2Url').value = asset.foto_kedua || '';
  if (asset.foto_utama) {
    document.getElementById('assetFoto1Preview').src = cloudinaryOptimize(asset.foto_utama);
    document.getElementById('assetFoto1Preview').classList.remove('hidden');
  }
  if (asset.foto_kedua) {
    document.getElementById('assetFoto2Preview').src = cloudinaryOptimize(asset.foto_kedua);
    document.getElementById('assetFoto2Preview').classList.remove('hidden');
  }

  // Load specs
  const specs = asset.spesifikasi || {};
  if (asset.kategori_utama === 'PROPERTI') {
    if (specs['Luas Tanah']) document.getElementById('specLT').value = specs['Luas Tanah'];
    if (specs['Luas Bangunan']) document.getElementById('specLB').value = specs['Luas Bangunan'];
    if (specs['Kamar Tidur']) document.getElementById('specKT').value = specs['Kamar Tidur'];
    if (specs['Kamar Mandi']) document.getElementById('specKM').value = specs['Kamar Mandi'];
  } else if (asset.kategori_utama === 'OTOMOTIF') {
    if (specs['Merk/Tipe']) document.getElementById('specMerk').value = specs['Merk/Tipe'];
    if (specs['Tahun']) document.getElementById('specTahun').value = specs['Tahun'];
    if (specs['Transmisi']) document.getElementById('specTransmisi').value = specs['Transmisi'];
    if (specs['Jarak Tempuh']) document.getElementById('specKMUnit').value = specs['Jarak Tempuh'];
    if (specs['Pajak']) document.getElementById('specPajak').value = specs['Pajak'];
  } else if (asset.kategori_utama === 'JASA_SERVIS') {
    if (specs['Estimasi Pengerjaan']) document.getElementById('specEstimasi').value = specs['Estimasi Pengerjaan'];
    if (specs['Garansi']) document.getElementById('specGaransi').value = specs['Garansi'];
  }

  // Load vault
  try {
    const vault = await fetchPrivateVault(asset.id);
    if (vault) {
      document.getElementById('vaultNamaPemilik').value = vault.nama_pemilik || '';
      document.getElementById('vaultWAPemilik').value = vault.wa_pemilik || '';
      document.getElementById('vaultHargaNet').value = vault.harga_net_pemilik || '';
      document.getElementById('vaultGMaps').value = vault.link_gmaps_presisi || '';
      document.getElementById('vaultLegalitas').value = vault.status_legalitas || 'SHM';
      document.getElementById('vaultArsipLink').value = vault.link_arsip_gdrive || '';
      document.getElementById('vaultCatatan').value = vault.catatan_internal || '';
      calcKomisi();
    }
  } catch (e) {}
}

async function deleteAsset(assetId) {
  if (!confirm('Yakin ingin menghapus aset ini? Data brankas privat juga akan dihapus permanen.')) return;
  try {
    await adminDeleteAsset(assetId);
    showToast('Aset berhasil dihapus.', 'success');
    await loadAdminAssets();
  } catch (err) {
    showToast('Gagal menghapus: ' + err.message, 'error');
  }
}

// ============================================================
// TAB 2: CRM PIPELINE, NEGOSIASI DEAL & E-FAKTUR
// ============================================================
async function loadCRMPipeline() {
  try {
    crmData = await adminFetchCRM();
    renderCRMPipeline();
    renderKeuanganTable();
  } catch (err) {
    console.error('Error loading CRM:', err);
  }
}

function renderCRMPipeline() {
  const kanban = document.getElementById('pipelineKanban');
  if (!kanban) return;

  kanban.innerHTML = CONFIG.CRM_STAGES.map(stage => {
    const stageItems = crmData.filter(item => item.stage === stage.key);
    const cards = stageItems.map(item => `
      <div class="pipeline-card cursor-pointer" onclick="openCRMDetail('${item.id}')">
        <div class="flex justify-between items-start mb-1">
          <span class="font-mono text-xs font-bold text-slate-500">${item.kode_aset || '-'}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${item.status_bayar === 'Lunas' ? 'bg-green-100 text-green-700' : (item.status_bayar === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}">${item.status_bayar}</span>
        </div>
        <p class="font-bold text-navy text-xs leading-tight">${item.nama_pembeli}</p>
        <p class="text-[11px] text-slate-500">${item.wa_pembeli}</p>
        ${item.invoice_number ? `<p class="text-[10px] font-mono text-emerald-600 font-bold mt-1"><i class="fas fa-file-invoice mr-1"></i>${item.invoice_number}</p>` : ''}
      </div>
    `).join('');

    return `
      <div class="pipeline-col flex-shrink-0 p-3">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-bold text-navy text-xs">${stage.label}</h3>
          <span class="bg-gold/20 text-gold-dark text-xs px-2 py-0.5 rounded-full font-bold">${stageItems.length}</span>
        </div>
        <div class="space-y-2 min-h-[120px]">${cards || '<p class="text-[11px] text-slate-400 text-center py-4">Kosong</p>'}</div>
      </div>
    `;
  }).join('');
}

function openCRMDetail(crmId) {
  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  const content = document.getElementById('crmDetailContent');
  const negoPrice = item.negotiated_price || item.nominal_biaya_survei || 0;

  content.innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p class="text-slate-500">Nama Konsumen</p>
          <p class="font-bold text-navy text-sm">${item.nama_pembeli}</p>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p class="text-slate-500">WhatsApp Konsumen</p>
          <p class="font-bold text-navy text-sm font-mono">${item.wa_pembeli}</p>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p class="text-slate-500">Kode Aset Terkait</p>
          <p class="font-bold text-gold text-sm font-mono">${item.kode_aset || '-'}</p>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p class="text-slate-500">Uang Komitmen Survei</p>
          <p class="font-bold text-navy text-sm">${formatRupiah(item.nominal_biaya_survei)}</p>
        </div>
      </div>

      <!-- NEGOSIASI HARGA & E-FAKTUR GENERATOR -->
      <div class="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
        <h4 class="font-bold text-navy text-xs flex items-center gap-1.5">
          <i class="fas fa-handshake text-gold"></i>Negosiasi Harga Deal & Penerbitan E-Faktur Resmi
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="form-label text-xs">Harga Deal Kesepakatan (Nego Rp)</label>
            <input type="number" id="crmNegoPrice_${item.id}" class="form-input text-xs font-bold text-navy" value="${negoPrice}" oninput="calcCRMFee('${item.id}')">
          </div>
          <div>
            <label class="form-label text-xs">Estimasi Sukses Fee Tabagsel Hub (2.5%)</label>
            <div id="crmFeeDisplay_${item.id}" class="form-input text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300">
              ${formatRupiah(Math.round(negoPrice * 0.025))}
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-amber-200">
          <span class="text-xs text-slate-600">No. Faktur: <strong class="font-mono text-navy">${item.invoice_number || 'Belum Diterbitkan'}</strong></span>
          <button type="button" onclick="lockDealAndGenerateInvoice('${item.id}')" class="btn-gold text-xs py-2 px-4 rounded-lg font-bold shadow">
            <i class="fas fa-file-invoice mr-1.5"></i>Kunci Deal & Terbitkan E-Faktur
          </button>
        </div>
      </div>

      <!-- Status Bayar & Stage -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
        <div>
          <label class="form-label text-xs">Status Verifikasi Bayar Survei</label>
          <select id="crmStatusBayar_${item.id}" class="form-input text-xs font-semibold">
            <option value="Menunggu" ${item.status_bayar === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
            <option value="Lunas" ${item.status_bayar === 'Lunas' ? 'selected' : ''}>✅ Lunas</option>
            <option value="Ditolak" ${item.status_bayar === 'Ditolak' ? 'selected' : ''}>❌ Ditolak</option>
          </select>
        </div>
        <div>
          <label class="form-label text-xs">Stage Pipeline</label>
          <select id="crmStage_${item.id}" class="form-input text-xs font-semibold">
            ${CONFIG.CRM_STAGES.map(s => `<option value="${s.key}" ${item.stage === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
            <option value="batal" ${item.stage === 'batal' ? 'selected' : ''}>❌ Batal</option>
          </select>
        </div>
      </div>

      <div>
        <label class="form-label text-xs">Catatan Admin</label>
        <textarea id="crmCatatan_${item.id}" class="form-input text-xs" rows="2">${item.catatan_admin || ''}</textarea>
      </div>

      <div class="flex flex-wrap gap-2 pt-2">
        <button onclick="updateCRMItem('${item.id}')" class="btn-navy flex-1 py-2.5 rounded-xl text-xs font-bold min-w-[120px]">
          <i class="fas fa-save mr-1.5"></i>Simpan Perubahan
        </button>
        <button onclick="openKuitansiModal('${item.id}')" class="px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow flex items-center gap-1">
          <i class="fas fa-receipt mr-1"></i>E-Kuitansi
        </button>
        ${item.invoice_number ? `
          <button onclick="previewInvoiceModal('${item.id}')" class="btn-gold py-2.5 px-4 rounded-xl text-xs font-bold">
            <i class="fas fa-eye mr-1"></i>Lihat E-Faktur
          </button>
        ` : ''}
      </div>
    </div>
  `;

  openModal('modalCRMDetail');
}

function calcCRMFee(crmId) {
  const negoVal = parseFloat(document.getElementById(`crmNegoPrice_${crmId}`)?.value) || 0;
  const feeDisplay = document.getElementById(`crmFeeDisplay_${crmId}`);
  if (feeDisplay) {
    const fee = Math.round(negoVal * 0.025);
    feeDisplay.textContent = formatRupiah(fee);
  }
}

async function lockDealAndGenerateInvoice(crmId) {
  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  const negoPrice = parseFloat(document.getElementById(`crmNegoPrice_${crmId}`)?.value) || 0;
  const successFee = Math.round(negoPrice * 0.025);
  const invNumber = item.invoice_number || generateInvoiceNumber();

  try {
    await adminUpdateDealInvoice(crmId, {
      negotiated_price: negoPrice,
      success_fee_amount: successFee,
      invoice_number: invNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      stage: 'closing',
      status_bayar: 'Lunas',
      payment_status: 'Lunas',
      paid_amount: successFee,
    });

    showToast(`E-Faktur ${invNumber} berhasil diterbitkan!`, 'success');
    await loadCRMPipeline();
    closeModal('modalCRMDetail');
    previewInvoiceModal(crmId);
  } catch (err) {
    showToast('Gagal menerbitkan faktur: ' + err.message, 'error');
  }
}

function previewInvoiceModal(crmId) {
  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  document.getElementById('invConsumerName').textContent = item.nama_pembeli;
  document.getElementById('invConsumerPhone').textContent = item.wa_pembeli;
  document.getElementById('invNumber').textContent = item.invoice_number || generateInvoiceNumber();
  document.getElementById('invDate').textContent = item.invoice_date || new Date().toLocaleDateString('id-ID');
  document.getElementById('invItemTitle').textContent = `Transaksi Aset [${item.kode_aset || 'Katalog Tabagsel Hub'}]`;
  document.getElementById('invInitialPrice').textContent = formatRupiah(item.nominal_biaya_survei || 0);
  document.getElementById('invDealPrice').textContent = formatRupiah(item.negotiated_price || 0);
  document.getElementById('invFeeAmount').textContent = formatRupiah(item.success_fee_amount || Math.round((item.negotiated_price || 0) * 0.025));

  // WhatsApp Button ke Konsumen
  const waMsg = encodeURIComponent(
    `*E-FAKTUR RESMI TABAGSEL HUB*\n` +
    `No. Faktur: ${item.invoice_number}\n` +
    `Konsumen: ${item.nama_pembeli}\n` +
    `Kode Aset: ${item.kode_aset}\n` +
    `Kesepakatan Harga Nego: ${formatRupiah(item.negotiated_price)}\n` +
    `Status: LUNAS & TERVERIFIKASI RESMI\n\n` +
    `Terima kasih telah mempercayakan transaksi Anda melalui Tabagsel Hub.`
  );
  document.getElementById('btnSendInvoiceWA').href = waDirectLink(item.wa_pembeli, decodeURIComponent(waMsg));

  openModal('modalEFaktur');
}

function printInvoice() {
  window.print();
}

async function updateCRMItem(crmId) {
  try {
    const updates = {
      status_bayar: document.getElementById(`crmStatusBayar_${crmId}`).value,
      stage: document.getElementById(`crmStage_${crmId}`).value,
      catatan_admin: document.getElementById(`crmCatatan_${crmId}`).value,
    };
    await adminUpdateCRM(crmId, updates);
    closeModal('modalCRMDetail');
    showToast('CRM Pipeline diperbarui!', 'success');
    await loadCRMPipeline();
  } catch (err) {
    showToast('Gagal update: ' + err.message, 'error');
  }
}

// ============================================================
// TAB BARU: LOG KEUANGAN & PEMBUKUAN REAL-TIME
// ============================================================

function getKeuanganItemDetails(item) {
  // 1. Tentukan target fee / tagihan
  let targetFee = 0;
  if (item.success_fee_amount && Number(item.success_fee_amount) > 0) {
    targetFee = Number(item.success_fee_amount);
  } else if (item.negotiated_price && Number(item.negotiated_price) > 0) {
    targetFee = Math.round(Number(item.negotiated_price) * 0.025);
  } else if (item.nominal_biaya_survei && Number(item.nominal_biaya_survei) > 0) {
    targetFee = Number(item.nominal_biaya_survei);
  }

  // 2. Tentukan kas riil yang sudah masuk
  let paid = 0;
  if (item.paid_amount !== undefined && item.paid_amount !== null && Number(item.paid_amount) > 0) {
    paid = Number(item.paid_amount);
  } else if (item.status_bayar === 'Lunas' || item.payment_status === 'Lunas') {
    paid = targetFee;
  }

  // 3. Tentukan status pembayaran
  let status = item.payment_status;
  if (!status) {
    if (paid >= targetFee && targetFee > 0) {
      status = 'Lunas';
    } else if (paid > 0) {
      status = 'DP / Termin';
    } else if (item.status_bayar === 'Lunas') {
      status = 'Lunas';
    } else {
      status = 'Belum Bayar';
    }
  }

  const sisa = Math.max(0, targetFee - paid);
  const dealPrice = Number(item.negotiated_price) || 0;

  return { targetFee, paid, status, sisa, dealPrice };
}

// Helper Terbilang Bahasa Indonesia untuk E-Kuitansi Resmi
function terbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'Nol Rupiah';
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  function bilangan(x) {
    if (x < 12) return satuan[x];
    if (x < 20) return bilangan(x - 10) + ' Belas';
    if (x < 100) return bilangan(Math.floor(x / 10)) + ' Puluh ' + bilangan(x % 10);
    if (x < 200) return 'Seratus ' + bilangan(x - 100);
    if (x < 1000) return bilangan(Math.floor(x / 100)) + ' Ratus ' + bilangan(x % 100);
    if (x < 2000) return 'Seribu ' + bilangan(x - 1000);
    if (x < 1000000) return bilangan(Math.floor(x / 1000)) + ' Ribu ' + bilangan(x % 1000);
    if (x < 1000000000) return bilangan(Math.floor(x / 1000000)) + ' Juta ' + bilangan(x % 1000000);
    if (x < 1000000000000) return bilangan(Math.floor(x / 1000000000)) + ' Miliar ' + bilangan(x % 1000000000);
    return bilangan(Math.floor(x / 1000000000000)) + ' Triliun ' + bilangan(x % 1000000000000);
  }
  return (bilangan(n) + ' Rupiah').replace(/\s+/g, ' ').trim();
}

function getItemDate(item) {
  if (item.invoice_date) {
    const d = new Date(item.invoice_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function onKeuanganPeriodeChange() {
  const periode = document.getElementById('filterKeuanganPeriode')?.value || 'all';
  const customBox = document.getElementById('boxFilterKeuanganCustom');
  if (customBox) {
    if (periode === 'custom') {
      customBox.classList.remove('hidden');
    } else {
      customBox.classList.add('hidden');
    }
  }
  renderKeuanganTable();
}

function getFilteredKeuanganData() {
  const statusFilter = document.getElementById('filterKeuanganStatus')?.value || '';
  const searchFilter = (document.getElementById('searchKeuangan')?.value || '').toLowerCase().trim();
  const periodeFilter = document.getElementById('filterKeuanganPeriode')?.value || 'all';
  const tglMulai = document.getElementById('filterKeuanganTglMulai')?.value || '';
  const tglSelesai = document.getElementById('filterKeuanganTglSelesai')?.value || '';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return crmData.filter(item => {
    const details = getKeuanganItemDetails(item);
    if (statusFilter && details.status !== statusFilter) {
      return false;
    }
    if (searchFilter) {
      const matchKlien = (item.nama_pembeli || '').toLowerCase().includes(searchFilter);
      const matchWA = (item.wa_pembeli || '').toLowerCase().includes(searchFilter);
      const matchAset = (item.kode_aset || '').toLowerCase().includes(searchFilter);
      const matchInv = (item.invoice_number || '').toLowerCase().includes(searchFilter);
      const matchNotes = (item.catatan_admin || '').toLowerCase().includes(searchFilter);
      if (!matchKlien && !matchWA && !matchAset && !matchInv && !matchNotes) {
        return false;
      }
    }

    if (periodeFilter !== 'all') {
      const d = getItemDate(item);
      if (periodeFilter === 'this_month') {
        if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return false;
      } else if (periodeFilter === 'last_month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        if (d.getFullYear() !== lastMonthDate.getFullYear() || d.getMonth() !== lastMonthDate.getMonth()) return false;
      } else if (periodeFilter === 'custom') {
        const itemYMD = d.toISOString().split('T')[0];
        if (tglMulai && itemYMD < tglMulai) return false;
        if (tglSelesai && itemYMD > tglSelesai) return false;
      }
    }

    return true;
  });
}

function renderKeuanganTable() {
  const tableBody = document.getElementById('keuanganTableBody');
  const emptyNotice = document.getElementById('keuanganEmpty');
  if (!tableBody) return;

  // 1. Kalkulasi 4 Kartu Ringkasan Angka Otomatis & Pemisahan Laba Komisi vs Markup
  let totalDeal = 0;
  let totalKas = 0;
  let totalFee = 0;
  let totalPiutang = 0;
  let totalLabaKomisi = 0;
  let totalLabaMarkup = 0;

  crmData.forEach(item => {
    const details = getKeuanganItemDetails(item);
    totalDeal += details.dealPrice;
    totalKas += details.paid;
    totalFee += details.targetFee;
    totalPiutang += details.sisa;

    // Hitung estimasi pemisahan komisi vs markup
    const asset = adminAssets.find(a => a.kode_aset === item.kode_aset || a.id === item.asset_id);
    if (asset) {
      const net = parseInt(asset.harga_net_pemilik || asset.net_price || 0);
      const tayang = parseInt(asset.harga_tayang || item.harga_kesepakatan || 0);
      if (net > 0 && tayang > net) {
        const komisi = Math.round(net * 0.025);
        const markup = tayang - net;
        totalLabaKomisi += komisi;
        totalLabaMarkup += markup;
      } else {
        totalLabaKomisi += details.targetFee;
      }
    } else {
      totalLabaKomisi += details.targetFee;
    }
  });

  const statDealEl = document.getElementById('statTotalNilaiDeal');
  const statKasEl = document.getElementById('statTotalKasMasuk');
  const statFeeEl = document.getElementById('statTotalSuksesFee');
  const statPiutangEl = document.getElementById('statTotalPiutang');

  if (statDealEl) statDealEl.textContent = formatRupiah(totalDeal);
  if (statKasEl) statKasEl.textContent = formatRupiah(totalKas);
  if (statFeeEl) statFeeEl.textContent = formatRupiah(totalFee);
  if (statPiutangEl) statPiutangEl.textContent = formatRupiah(totalPiutang);

  // Update Analitik Pemisahan Laba
  const totalGabungan = totalLabaKomisi + totalLabaMarkup;
  const persenKomisi = totalGabungan > 0 ? Math.round((totalLabaKomisi / totalGabungan) * 100) : 50;
  const persenMarkup = totalGabungan > 0 ? (100 - persenKomisi) : 50;

  const statLabaKomisiEl = document.getElementById('statLabaKomisi');
  const badgePersenLabaKomisiEl = document.getElementById('badgePersenLabaKomisi');
  const statLabaMarkupEl = document.getElementById('statLabaMarkup');
  const badgePersenLabaMarkupEl = document.getElementById('badgePersenLabaMarkup');
  const statLabaTotalGabunganEl = document.getElementById('statLabaTotalGabungan');
  const barLabaKomisiEl = document.getElementById('barLabaKomisi');
  const barLabaMarkupEl = document.getElementById('barLabaMarkup');
  const txtDistribusiLabaRatioEl = document.getElementById('txtDistribusiLabaRatio');

  if (statLabaKomisiEl) statLabaKomisiEl.textContent = formatRupiah(totalLabaKomisi);
  if (badgePersenLabaKomisiEl) badgePersenLabaKomisiEl.textContent = `${persenKomisi}%`;
  if (statLabaMarkupEl) statLabaMarkupEl.textContent = formatRupiah(totalLabaMarkup);
  if (badgePersenLabaMarkupEl) badgePersenLabaMarkupEl.textContent = `${persenMarkup}%`;
  if (statLabaTotalGabunganEl) statLabaTotalGabunganEl.textContent = formatRupiah(totalGabungan);
  if (barLabaKomisiEl) barLabaKomisiEl.style.width = `${persenKomisi}%`;
  if (barLabaMarkupEl) barLabaMarkupEl.style.width = `${persenMarkup}%`;
  if (txtDistribusiLabaRatioEl) txtDistribusiLabaRatioEl.textContent = `${persenKomisi}% Komisi Pemilik | ${persenMarkup}% Laba Markup Jual`;

  // 2. Filter & Pencarian Baris Buku Kas (termasuk filter tanggal periode)
  const filteredItems = getFilteredKeuanganData();

  if (filteredItems.length === 0) {
    tableBody.innerHTML = '';
    if (emptyNotice) emptyNotice.classList.remove('hidden');
    return;
  }

  if (emptyNotice) emptyNotice.classList.add('hidden');

  tableBody.innerHTML = filteredItems.map(item => {
    const details = getKeuanganItemDetails(item);
    const dateStr = item.invoice_date || (item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-');

    let badgeStatus = '';
    if (details.status === 'Lunas') {
      badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Lunas</span>';
    } else if (details.status === 'DP / Termin') {
      badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">🟡 DP / Termin</span>';
    } else {
      badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">🔴 Belum Bayar</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">${dateStr}</td>
        <td class="p-3.5 whitespace-nowrap">
          ${item.invoice_number ? `<span class="font-mono font-bold text-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${item.invoice_number}</span>` : '<span class="text-slate-400 italic">Belum terbit</span>'}
        </td>
        <td class="p-3.5">
          <p class="font-bold text-navy leading-tight">${item.nama_pembeli}</p>
          <p class="text-slate-400 font-mono text-[10px]">${item.wa_pembeli}</p>
        </td>
        <td class="p-3.5 whitespace-nowrap">
          <span class="font-mono font-bold text-gold">${item.kode_aset || 'SURVEI-LANGSUNG'}</span>
          <p class="text-[10px] text-slate-400">${item.metode_survei === 'video_call' ? 'Live Video' : 'Survei Lapangan'}</p>
        </td>
        <td class="p-3.5 text-right font-bold text-navy whitespace-nowrap">
          ${details.dealPrice > 0 ? formatRupiah(details.dealPrice) : '<span class="text-slate-400 font-normal">-</span>'}
        </td>
        <td class="p-3.5 text-right font-bold text-gold whitespace-nowrap">
          ${formatRupiah(details.targetFee)}
        </td>
        <td class="p-3.5 text-right font-bold text-emerald-600 whitespace-nowrap">
          ${formatRupiah(details.paid)}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          ${badgeStatus}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="openCatatBayarModal('${item.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1" title="Catat / Perbarui Pembayaran">
              <i class="fas fa-cash-register"></i> Catat Bayar
            </button>
            <button type="button" onclick="openKuitansiModal('${item.id}')" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1" title="Cetak / Kirim E-Kuitansi DP/Survei">
              <i class="fas fa-receipt"></i> Kuitansi
            </button>
            ${item.invoice_number ? `
              <button type="button" onclick="previewInvoiceModal('${item.id}')" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow transition-all flex items-center gap-1" title="Lihat E-Faktur">
                <i class="fas fa-file-invoice"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openCatatBayarModal(crmId) {
  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  const details = getKeuanganItemDetails(item);

  document.getElementById('catatBayarCrmId').value = item.id;
  document.getElementById('catatBayarKlien').textContent = `${item.nama_pembeli} (${item.wa_pembeli})`;
  document.getElementById('catatBayarFaktur').textContent = `Aset: ${item.kode_aset || '-'} | E-Faktur: ${item.invoice_number || 'Belum Terbit'}`;
  document.getElementById('catatBayarTotalTagihan').textContent = formatRupiah(details.targetFee);
  
  document.getElementById('catatBayarStatus').value = details.status;
  document.getElementById('catatBayarMetode').value = item.payment_method || 'Transfer Bank Sumut';
  document.getElementById('catatBayarNominal').value = details.paid > 0 ? details.paid : details.targetFee;
  document.getElementById('catatBayarCatatan').value = item.catatan_admin || '';

  openModal('modalCatatBayar');
}

async function submitCatatBayar(e) {
  e.preventDefault();
  const crmId = document.getElementById('catatBayarCrmId').value;
  const status = document.getElementById('catatBayarStatus').value;
  const metode = document.getElementById('catatBayarMetode').value;
  const nominal = parseFloat(document.getElementById('catatBayarNominal').value) || 0;
  const catatan = document.getElementById('catatBayarCatatan').value;

  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  try {
    const updates = {
      payment_status: status,
      payment_method: metode,
      paid_amount: nominal,
      catatan_admin: catatan,
      status_bayar: status === 'Lunas' ? 'Lunas' : (status === 'DP / Termin' ? 'Menunggu' : item.status_bayar),
    };

    if (status === 'Lunas' && (item.stage === 'negosiasi' || item.stage === 'eksekusi')) {
      updates.stage = 'closing';
    }

    await adminUpdateCRM(crmId, updates);
    showToast('Pembayaran berhasil dicatat ke buku kas!', 'success');
    closeModal('modalCatatBayar');
    await loadCRMPipeline();
  } catch (err) {
    showToast('Gagal mencatat pembayaran: ' + err.message, 'error');
  }
}

function exportKeuanganCSV() {
  const filteredItems = getFilteredKeuanganData();
  if (!filteredItems || filteredItems.length === 0) {
    showToast('Tidak ada data transaksi yang cocok dengan filter aktif untuk diekspor.', 'error');
    return;
  }

  const delimiter = ';';
  const headers = [
    'Tanggal',
    'No. E-Faktur',
    'Nama Klien',
    'No. WhatsApp',
    'Kode Aset',
    'Harga Kesepakatan (Rp)',
    'Hak Sukses Fee Hub (Rp)',
    'Total Kas Masuk (Rp)',
    'Sisa Piutang (Rp)',
    'Status Pembayaran',
    'Metode Pembayaran',
    'Catatan Pembayaran'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = filteredItems.map(item => {
    const details = getKeuanganItemDetails(item);
    const dateStr = item.invoice_date || (item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-');
    return [
      escapeCSV(dateStr),
      escapeCSV(item.invoice_number || '-'),
      escapeCSV(item.nama_pembeli || '-'),
      escapeCSV(item.wa_pembeli || '-'),
      escapeCSV(item.kode_aset || '-'),
      escapeCSV(details.dealPrice),
      escapeCSV(details.targetFee),
      escapeCSV(details.paid),
      escapeCSV(details.sisa),
      escapeCSV(details.status),
      escapeCSV(item.payment_method || '-'),
      escapeCSV(item.catatan_admin || '-')
    ].join(delimiter);
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(delimiter), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `Laporan_Keuangan_Tabagsel_Hub_${todayStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Laporan keuangan (${filteredItems.length} transaksi) berhasil diunduh!`, 'success');
}

// ============================================================
// DUAL E-KUITANSI (KUITANSI PEMBELI VS BERITA ACARA PEMILIK)
// ============================================================
let currentKuitansiCrmId = null;

function switchKuitansiMode(mode) {
  const btnPembeli = document.getElementById('btnTabKwtPembeli');
  const btnPemilik = document.getElementById('btnTabKwtPemilik');
  const viewPembeli = document.getElementById('viewKwtPembeli');
  const viewPemilik = document.getElementById('viewKwtPemilik');

  if (mode === 'pemilik') {
    if (viewPembeli) viewPembeli.classList.add('hidden');
    if (viewPemilik) viewPemilik.classList.remove('hidden');
    if (btnPembeli) {
      btnPembeli.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-slate-600 hover:bg-white/60';
    }
    if (btnPemilik) {
      btnPemilik.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-white text-navy shadow-sm border border-slate-300';
    }
  } else {
    if (viewPemilik) viewPemilik.classList.add('hidden');
    if (viewPembeli) viewPembeli.classList.remove('hidden');
    if (btnPemilik) {
      btnPemilik.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-slate-600 hover:bg-white/60';
    }
    if (btnPembeli) {
      btnPembeli.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-white text-navy shadow-sm border border-slate-300';
    }
  }
}

async function openKuitansiModal(crmId, defaultMode = 'pembeli') {
  currentKuitansiCrmId = crmId;
  const item = crmData.find(c => c.id === crmId);
  if (!item) return;

  const details = getKeuanganItemDetails(item);
  const nominalPembeli = details.dealPrice > 0 ? details.dealPrice : (details.paid > 0 ? details.paid : (item.nominal_biaya_survei || details.targetFee || 150000));
  const kwtCode = `KWT/TH/${new Date().getFullYear()}/${(item.kode_aset || 'DEAL').replace(/[^a-zA-Z0-9]/g, '')}`;
  const baCode = `BA-NET/TH/${new Date().getFullYear()}/${(item.kode_aset || 'NET').replace(/[^a-zA-Z0-9]/g, '')}`;

  // 1. ISI DOKUMEN A: KUITANSI PEMBELI
  const kwtNumEl = document.getElementById('kwtNumber');
  const kwtNamaEl = document.getElementById('kwtNama');
  const kwtTerbilangEl = document.getElementById('kwtTerbilang');
  const kwtPeruntukanEl = document.getElementById('kwtPeruntukan');
  const kwtMetodeEl = document.getElementById('kwtMetode');
  const kwtNominalEl = document.getElementById('kwtNominal');
  const kwtTanggalLokasiEl = document.getElementById('kwtTanggalLokasi');
  const btnSendKuitansiWA = document.getElementById('btnSendKuitansiWA');

  if (kwtNumEl) kwtNumEl.textContent = kwtCode;
  if (kwtNamaEl) kwtNamaEl.textContent = item.nama_pembeli || 'Klien Pembeli Tabagsel Hub';
  if (kwtTerbilangEl) kwtTerbilangEl.textContent = terbilang(nominalPembeli);
  if (kwtPeruntukanEl) {
    kwtPeruntukanEl.textContent = `Pelunasan Pembelian Sah 1 Unit [${item.kode_aset || 'Aset'}] Melalui Tabagsel Hub`;
  }
  if (kwtMetodeEl) kwtMetodeEl.textContent = item.payment_method || 'Transfer Bank Sumut (Rekening Resmi Tabagsel Hub)';
  if (kwtNominalEl) kwtNominalEl.textContent = formatRupiah(nominalPembeli);
  
  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  if (kwtTanggalLokasiEl) kwtTanggalLokasiEl.textContent = `Padangsidimpuan, ${todayStr}`;

  if (btnSendKuitansiWA && item.wa_pembeli) {
    const rawPhone = item.wa_pembeli.replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : (rawPhone.startsWith('62') ? rawPhone : '62' + rawPhone);
    const textWA = `*KUITANSI RESMI PELUNASAN UNIT - TABAGSEL HUB*\n` +
      `No. Dokumen: *${kwtCode}*\n` +
      `Telah Diterima Dari: *${item.nama_pembeli}*\n` +
      `Nominal: *${formatRupiah(nominalPembeli)}*\n` +
      `Terbilang: _${terbilang(nominalPembeli)}_\n` +
      `Peruntukan: ${kwtPeruntukanEl ? kwtPeruntukanEl.textContent : 'Pelunasan Unit'}\n` +
      `Tanggal: ${todayStr}\n\n` +
      `_Status: LUNAS & DITERIMA RESMI TABAGSEL HUB_`;
    btnSendKuitansiWA.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textWA)}`;
  }

  // 2. ISI DOKUMEN B: BERITA ACARA SERAH TERIMA PEMILIK ASLI (HAK NET TERKUNCI)
  const baNumEl = document.getElementById('baNumber');
  const baNamaEl = document.getElementById('baNamaPemilik');
  const baWAEl = document.getElementById('baWAPemilik');
  const baObjekEl = document.getElementById('baObjekAset');
  const baTerbilangEl = document.getElementById('baTerbilang');
  const baNominalNetEl = document.getElementById('baNominalNet');
  const baTanggalLokasiEl = document.getElementById('baTanggalLokasi');
  const baSignNamaEl = document.getElementById('baSignNamaPemilik');
  const btnSendBeritaAcaraWA = document.getElementById('btnSendBeritaAcaraWA');

  let namaPemilik = 'Pemilik Aset Asli';
  let waPemilik = '';
  let hargaNet = 0;
  
  const asset = adminAssets.find(a => a.kode_aset === item.kode_aset || a.id === item.asset_id);
  if (asset) {
    try {
      const vault = await fetchPrivateVault(asset.id);
      if (vault) {
        namaPemilik = vault.nama_pemilik || asset.nama_pemilik || namaPemilik;
        waPemilik = vault.wa_pemilik || asset.wa_pemilik || '';
        hargaNet = parseInt(vault.harga_net_pemilik || 0);
      }
    } catch (e) {}
  }

  if (hargaNet === 0) {
    hargaNet = Math.round(nominalPembeli * 0.85);
  }

  if (baNumEl) baNumEl.textContent = baCode;
  if (baNamaEl) baNamaEl.textContent = namaPemilik;
  if (baWAEl) baWAEl.textContent = waPemilik || '-';
  if (baObjekEl) baObjekEl.textContent = `${item.kode_aset || 'Aset'} - ${asset ? asset.judul : 'Unit Terverifikasi'}`;
  if (baTerbilangEl) baTerbilangEl.textContent = terbilang(hargaNet);
  if (baNominalNetEl) baNominalNetEl.textContent = formatRupiah(hargaNet);
  if (baTanggalLokasiEl) baTanggalLokasiEl.textContent = `Padangsidimpuan, ${todayStr}`;
  if (baSignNamaEl) baSignNamaEl.textContent = namaPemilik;

  if (btnSendBeritaAcaraWA && waPemilik) {
    const rawWA = waPemilik.replace(/\D/g, '');
    const cleanWA = rawWA.startsWith('0') ? '62' + rawWA.slice(1) : (rawWA.startsWith('62') ? rawWA : '62' + rawWA);
    const textBA = `*BERITA ACARA SERAH TERIMA DANA PELUNASAN NET*\n` +
      `*TABAGSEL HUB - DOKUMEN RESMI PELEPASAN HAK*\n` +
      `--------------------------------------------------\n` +
      `No. Dokumen: *${baCode}*\n` +
      `Kepada Pemilik Asli: *${namaPemilik}*\n` +
      `Objek Aset: *${item.kode_aset || 'Aset'}*\n` +
      `Nominal Bersih Diterima: *${formatRupiah(hargaNet)}*\n` +
      `Terbilang: _${terbilang(hargaNet)}_\n` +
      `Tanggal: ${todayStr}\n\n` +
      `_Status: Hak harga bersih (net) telah diserah-terimakan tuntas dan sah tanpa potongan. Terima kasih atas kerja sama titip kelola bersama Tabagsel Hub._`;
    btnSendBeritaAcaraWA.href = `https://wa.me/${cleanWA}?text=${encodeURIComponent(textBA)}`;
  }

  switchKuitansiMode(defaultMode);
  openModal('modalEKuitansi');
}

function printKuitansi(mode = 'pembeli') {
  window.print();
}

// ============================================================
// GENERATOR BROSUR PDF INSTAN 1-HALAMAN (FLYER PROMOSI A4)
// ============================================================
function bukaFlyerAset(assetId) {
  const asset = adminAssets.find(a => a.id === assetId);
  if (!asset) return;

  const kodeEl = document.getElementById('flyerKodeAset');
  const katEl = document.getElementById('flyerKategori');
  const judulEl = document.getElementById('flyerJudul');
  const lokasiEl = document.getElementById('flyerLokasi');
  const foto1El = document.getElementById('flyerFoto1');
  const foto2El = document.getElementById('flyerFoto2');
  const hargaEl = document.getElementById('flyerHarga');
  const legalitasEl = document.getElementById('flyerLegalitas');
  const deskripsiEl = document.getElementById('flyerDeskripsi');
  const specsBox = document.getElementById('flyerSpecsContainer');
  const btnWA = document.getElementById('btnSendFlyerWA');

  if (kodeEl) kodeEl.textContent = asset.kode_aset;
  if (katEl) katEl.textContent = (asset.kategori_utama || 'ASET') + ' TERVERIFIKASI';
  if (judulEl) judulEl.textContent = asset.judul;
  if (lokasiEl) lokasiEl.textContent = (asset.kecamatan ? asset.kecamatan + ', ' : '') + asset.kabupaten;
  
  const img1 = asset.foto_utama ? cloudinaryOptimize(asset.foto_utama) : 'assets/images/default-listing.jpg';
  const img2 = asset.foto_kedua ? cloudinaryOptimize(asset.foto_kedua) : img1;
  if (foto1El) foto1El.src = img1;
  if (foto2El) foto2El.src = img2;

  const hargaFormatted = formatRupiah(asset.harga_tayang) + (asset.satuan_harga && asset.satuan_harga !== 'Total' ? ' / ' + asset.satuan_harga : '');
  if (hargaEl) hargaEl.textContent = hargaFormatted;
  if (legalitasEl) legalitasEl.textContent = asset.legalitas || (asset.spesifikasi && asset.spesifikasi['Legalitas']) || 'SHM / Resmi';
  if (deskripsiEl) deskripsiEl.textContent = asset.deskripsi || 'Aset resmi terverifikasi lapangan oleh tim kurasi Tabagsel Hub dengan standar transaksi aman satu pintu.';

  if (specsBox) {
    const specs = asset.spesifikasi || {};
    const entries = Object.entries(specs);
    if (entries.length > 0) {
      specsBox.innerHTML = entries.slice(0, 8).map(([k, v]) => `
        <div class="p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span class="text-slate-400 block text-[9px] uppercase">${k}</span>
          <strong class="text-navy font-bold text-xs">${v}</strong>
        </div>
      `).join('');
    } else {
      specsBox.innerHTML = `
        <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 col-span-2">
          <span class="text-slate-400 block text-[9px] uppercase">Status Kurasi</span>
          <strong class="text-emerald-700 font-bold text-xs">Fisik & Dokumen Siap Transaksi</strong>
        </div>
      `;
    }
  }

  if (btnWA) {
    const textFlyer = `*REKOMENDASI ASET RESMI - TABAGSEL HUB*\n` +
      `Kode: *${asset.kode_aset}*\n` +
      `Judul: *${asset.judul}*\n` +
      `Lokasi: *${(asset.kecamatan ? asset.kecamatan + ', ' : '') + asset.kabupaten}*\n` +
      `Harga Resmi: *${hargaFormatted}*\n` +
      `Legalitas: *${legalitasEl ? legalitasEl.textContent : 'SHM'}*\n\n` +
      `Lihat brosur online & jadwalkan survei:\n` +
      `https://tabagsel-hub.vercel.app/?aset=${asset.kode_aset || asset.id}`;
    btnWA.href = `https://wa.me/?text=${encodeURIComponent(textFlyer)}`;
  }

  openModal('modalFlyerAset');
}

function printFlyer() {
  window.print();
}

// ============================================================
// SUB-KALKULATOR INSENTIF SURVEYOR / TIM LAPANGAN (FEE SPLIT)
// ============================================================
function toggleFeeSplitPanel() {
  const container = document.getElementById('panelFeeSplitContainer');
  const txt = document.getElementById('txtToggleFeeSplit');
  const icon = document.getElementById('iconToggleFeeSplit');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    if (txt) txt.textContent = 'Tutup';
    if (icon) icon.className = 'fas fa-chevron-up text-[10px]';
    calcFeeSplit();
  } else {
    container.classList.add('hidden');
    if (txt) txt.textContent = 'Buka Kalkulator';
    if (icon) icon.className = 'fas fa-chevron-down text-[10px]';
  }
}

function setSurveyorFeePreset(preset) {
  const inputFee = document.getElementById('vaultFeeSurveyor');
  if (inputFee) {
    const cur = parseInt(inputFee.value) || 0;
    inputFee.value = cur + preset;
    calcFeeSplit();
  }
}

function calcFeeSplit(passedTotalHak = null) {
  const feeSurveyor = parseInt(document.getElementById('vaultFeeSurveyor')?.value) || 0;
  
  let totalHak = 0;
  if (passedTotalHak !== null) {
    totalHak = passedTotalHak;
  } else {
    const hargaNet = parseInt(document.getElementById('vaultHargaNet')?.value) || 0;
    const persenKomisi = parseFloat(document.getElementById('vaultKomisiPersen')?.value) || 0;
    const komisiPemilik = Math.round(hargaNet * (persenKomisi / 100));
    const markupNominal = parseInt(document.getElementById('vaultMarkupNominal')?.value) || 0;
    totalHak = komisiPemilik + markupNominal;
  }

  const labaKasHub = Math.max(0, totalHak - feeSurveyor);

  const displaySurveyor = document.getElementById('splitDisplaySurveyor');
  const displayKas = document.getElementById('splitDisplayKasHub');

  if (displaySurveyor) displaySurveyor.textContent = formatRupiah(feeSurveyor);
  if (displayKas) displayKas.textContent = formatRupiah(labaKasHub);
}

// ============================================================
// TAB 3: ORDER JASA SURVEI & PENUGASAN MITRA / SURVEYOR
// ============================================================
async function loadJasaOrders() {
  try {
    const orders = await adminFetchJasaSurvei();
    renderJasaOrders(orders);
  } catch (err) {
    console.error('Error loading jasa orders:', err);
  }
}

function renderJasaOrders(orders) {
  const list = document.getElementById('jasaOrderList');
  const empty = document.getElementById('jasaOrderEmpty');
  if (!list) return;

  if (orders.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = orders.map(order => {
    const partner = servicePartnersList.find(p => p.id === order.partner_id);
    const partnerName = partner ? `${partner.partner_name} (${partner.specialty})` : 'Belum Ditugaskan';

    return `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div class="flex justify-between items-start flex-wrap gap-2">
          <div>
            <span class="text-xs font-mono font-bold text-slate-500">${order.id.substring(0, 8).toUpperCase()}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ml-1 ${order.status_bayar === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${order.status_bayar}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ml-1 bg-slate-100 text-navy uppercase">${order.status_order}</span>
          </div>
          <span class="text-xs text-slate-400">${new Date(order.created_at).toLocaleDateString('id-ID')}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-slate-500 font-medium">Pemesan</p>
            <p class="font-bold text-navy text-sm">${order.nama_pemesan}</p>
            <p class="text-slate-500 font-mono">${order.wa_pemesan}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-slate-500 font-medium">Layanan & Wilayah</p>
            <p class="font-bold text-gold text-sm">${order.paket_jasa.toUpperCase()}</p>
            <p class="text-slate-700">${order.kabupaten_target}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-slate-500 font-medium">Mitra Rekanan Ditugaskan</p>
            <p class="font-bold text-navy text-sm">${partnerName}</p>
            ${partner ? `<p class="text-emerald-700 font-mono text-[11px]">${partner.phone}</p>` : ''}
          </div>
        </div>

        <div class="text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1">
          <p><strong>Alamat / Objek:</strong> ${order.alamat_atau_link || '-'}</p>
          <p><strong>Poin Pekerjaan:</strong> ${order.poin_cek_khusus || '-'}</p>
          ${order.catatan_laporan_mitra ? `<p class="text-blue-700"><strong>Laporan Mitra:</strong> ${order.catatan_laporan_mitra}</p>` : ''}
        </div>

        <!-- Penugasan Mitra Dropdown & Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-xs font-bold text-slate-600">Pilih Mitra:</label>
            <select id="selectMitraOrder_${order.id}" class="form-input text-xs py-1.5 w-auto" onchange="assignPartnerToOrder('${order.id}', this.value)">
              <option value="">-- Pilih Mitra Rekanan --</option>
              ${servicePartnersList.map(p => `<option value="${p.id}" ${order.partner_id === p.id ? 'selected' : ''}>${p.partner_name} (${p.specialty})</option>`).join('')}
            </select>
          </div>

          <div class="flex gap-2 flex-wrap">
            <!-- Tombol Kirim Tugas ke WA Mitra -->
            <button onclick="dispatchTaskToPartnerWA('${order.id}')" class="btn-whatsapp text-xs py-2 px-3.5 rounded-xl font-bold shadow-sm">
              <i class="fab fa-whatsapp text-sm mr-1"></i>Kirim Tugas ke WA Mitra
            </button>
            <!-- Tombol Catat Laporan WA & Foto -->
            <button onclick="openLaporanMitraModal('${order.id}')" class="btn-gold text-xs py-2 px-3.5 rounded-xl font-bold shadow-sm">
              <i class="fas fa-camera mr-1"></i>Catat Laporan WA & Foto
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function assignPartnerToOrder(orderId, partnerId) {
  try {
    await adminAssignOrderPartner(orderId, {
      partner_id: partnerId || null,
      status_order: partnerId ? 'assigned' : 'pending',
    });
    showToast('Mitra rekanan berhasil ditugaskan!', 'success');
    await loadJasaOrders();
  } catch (err) {
    showToast('Gagal menugaskan mitra: ' + err.message, 'error');
  }
}

function dispatchTaskToPartnerWA(orderId) {
  const order = crmData.find(c => c.id === orderId) || adminAssets.find(a => a.id === orderId); // fallback
  // Find in orders
  adminFetchJasaSurvei().then(orders => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const partner = servicePartnersList.find(p => p.id === targetOrder.partner_id);
    if (!partner) {
      alert('Pilih dan tugaskan Mitra Rekanan terlebih dahulu!');
      return;
    }

    const pesan = 
      `*PENUGASAN RESMI - TABAGSEL HUB*\n` +
      `Halo Mitra Rekanan ${partner.partner_name} (${partner.business_name || 'Vendor Resmi'}),\n` +
      `Terdapat penugasan pekerjaan baru di wilayah Anda:\n\n` +
      `• No. Order: ${targetOrder.id.substring(0, 8).toUpperCase()}\n` +
      `• Layanan: ${targetOrder.paket_jasa.toUpperCase()} (${targetOrder.sumber_aset === 'katalog' ? 'Katalog' : 'Luar Katalog'})\n` +
      `• Lokasi: ${targetOrder.kabupaten_target}\n` +
      `• Alamat/Objek: ${targetOrder.alamat_atau_link || '-'}\n` +
      `• Poin Cek: ${targetOrder.poin_cek_khusus || 'Pemeriksaan standar'}\n\n` +
      `Mohon segera konfirmasi ketersediaan dan koordinasikan jadwal pelaksanaan dengan Admin Pusat Tabagsel Hub. Terima kasih.`;

    window.open(waDirectLink(partner.phone, pesan), '_blank');
  });
}

function openLaporanMitraModal(orderId) {
  document.getElementById('laporanOrderId').value = orderId;
  document.getElementById('laporanOrderCode').textContent = orderId.substring(0, 8).toUpperCase();
  document.getElementById('laporanFotoPreview').classList.add('hidden');
  document.getElementById('laporanFotoFile').value = '';
  document.getElementById('laporanCatatanTeks').value = '';
  openModal('modalLaporanMitra');
}

async function submitLaporanMitra(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Menyimpan...';

  const orderId = document.getElementById('laporanOrderId').value;
  const statusAlur = document.getElementById('laporanStatusAlur').value;
  const catatan = document.getElementById('laporanCatatanTeks').value;

  try {
    let fotoUrl = '';
    const fotoFile = document.getElementById('laporanFotoFile').files[0];
    if (fotoFile) {
      try {
        fotoUrl = await uploadToCloudinary(fotoFile, CONFIG.CLOUDINARY_FOLDERS.LAPORAN_MITRA);
      } catch (uploadErr) {
        console.warn('Cloudinary upload warning:', uploadErr);
        fotoUrl = '';
      }
    }

    await adminAssignOrderPartner(orderId, {
      status_order: statusAlur,
      catatan_laporan_mitra: catatan,
      laporan_url: fotoUrl || undefined,
    });

    closeModal('modalLaporanMitra');
    showToast('Laporan progres pengerjaan mitra berhasil disimpan!', 'success');
    await loadJasaOrders();
  } catch (err) {
    showToast('Gagal menyimpan laporan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Laporan Progres';
  }
}

// ============================================================
// TAB 4: DIREKTORI MITRA REKANAN (SUPER ADMIN)
// ============================================================
async function loadPartnerList() {
  try {
    servicePartnersList = await adminFetchServicePartners();
    renderPartnerList();
    populatePartnerDropdown();
  } catch (err) {
    console.error('Error loading service partners:', err);
  }
}

function renderPartnerList() {
  const container = document.getElementById('partnerList');
  const empty = document.getElementById('partnerEmpty');
  if (!container) return;

  if (servicePartnersList.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = servicePartnersList.map(p => `
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between mb-2">
          <div>
            <h3 class="font-bold text-navy text-sm md:text-base leading-snug">${p.partner_name}</h3>
            ${p.business_name ? `<p class="text-xs text-slate-500">${p.business_name}</p>` : ''}
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'aktif' ? 'badge-partner-aktif' : 'badge-partner-nonaktif'}">
            ${p.status.toUpperCase()}
          </span>
        </div>

        <div class="space-y-1 text-xs text-slate-600 mb-3">
          <p><i class="fas fa-tools text-amber-500 w-4"></i>${p.specialty}</p>
          <p><i class="fas fa-map-marker-alt text-rose-500 w-4"></i>${p.coverage_area}</p>
          <p><i class="fab fa-whatsapp text-emerald-600 w-4"></i><strong class="font-mono">${p.phone}</strong></p>
          <p><i class="fas fa-percentage text-gold w-4"></i>Sukses Fee Tabagsel Hub: <strong>${p.success_fee_percent}%</strong></p>
        </div>

        ${p.notes ? `<p class="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">${p.notes}</p>` : ''}
      </div>

      <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3">
        <a href="${waDirectLink(p.phone, 'Halo Mitra ' + p.partner_name + ', admin Tabagsel Hub menghubungi Anda.')}" target="_blank" class="text-xs text-emerald-600 font-bold flex items-center gap-1 hover:underline">
          <i class="fab fa-whatsapp"></i> Hubungi WA
        </a>
        <div class="flex gap-1.5">
          <button onclick="openMitraRekananForm('${p.id}')" class="btn-navy text-xs py-1 px-2.5 rounded-lg">Edit</button>
          <button onclick="deletePartner('${p.id}')" class="text-xs bg-rose-50 text-rose-600 py-1 px-2 rounded-lg font-bold hover:bg-rose-100">Hapus</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openMitraRekananForm(partnerId = null) {
  document.getElementById('formPartner').reset();
  document.getElementById('partnerEditId').value = '';
  document.getElementById('partnerFormTitle').innerHTML = '<i class="fas fa-handshake-angle text-gold mr-2"></i>Tambah Mitra Rekanan';

  if (partnerId) {
    const p = servicePartnersList.find(item => item.id === partnerId);
    if (p) {
      document.getElementById('partnerFormTitle').innerHTML = '<i class="fas fa-edit text-gold mr-2"></i>Edit Mitra Rekanan';
      document.getElementById('partnerEditId').value = p.id;
      document.getElementById('partnerName').value = p.partner_name;
      document.getElementById('partnerBusinessName').value = p.business_name || '';
      document.getElementById('partnerSpecialty').value = p.specialty;
      document.getElementById('partnerCoverageArea').value = p.coverage_area;
      document.getElementById('partnerPhone').value = p.phone;
      document.getElementById('partnerSuccessFee').value = p.success_fee_percent || 10;
      document.getElementById('partnerStatus').value = p.status || 'aktif';
      document.getElementById('partnerNotes').value = p.notes || '';
    }
  }

  openModal('modalPartnerForm');
}

async function savePartner(e) {
  e.preventDefault();
  const partnerData = {
    partner_name: document.getElementById('partnerName').value,
    business_name: document.getElementById('partnerBusinessName').value,
    specialty: document.getElementById('partnerSpecialty').value,
    coverage_area: document.getElementById('partnerCoverageArea').value,
    phone: document.getElementById('partnerPhone').value,
    success_fee_percent: parseFloat(document.getElementById('partnerSuccessFee').value) || 10,
    status: document.getElementById('partnerStatus').value,
    notes: document.getElementById('partnerNotes').value,
  };

  const editId = document.getElementById('partnerEditId').value;
  if (editId) partnerData.id = editId;

  try {
    await adminUpsertServicePartner(partnerData);
    closeModal('modalPartnerForm');
    showToast('Data mitra rekanan berhasil disimpan!', 'success');
    await loadPartnerList();
  } catch (err) {
    showToast('Gagal menyimpan mitra: ' + err.message, 'error');
  }
}

async function deletePartner(partnerId) {
  if (!confirm('Yakin ingin menghapus mitra ini?')) return;
  try {
    await adminDeleteServicePartner(partnerId);
    showToast('Mitra rekanan dihapus.', 'success');
    await loadPartnerList();
  } catch (err) {
    showToast('Gagal menghapus mitra: ' + err.message, 'error');
  }
}

// ============================================================
// TAB 5: ANTREAN TITIP ASET & SAYEMBARA
// ============================================================
// ============================================================
// TAB 5: ANTREAN TITIP ASET & SAYEMBARA (AGEN LAPANGAN TO WEBSITE)
// ============================================================

let currentTitipListCache = [];

async function loadTitipAsetAdmin() {
  try {
    const data = await adminFetchTitipAset();
    currentTitipListCache = data || [];
    const list = document.getElementById('titipList');
    const empty = document.getElementById('titipEmpty');
    if (!list) return;

    if (currentTitipListCache.length === 0) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    list.innerHTML = currentTitipListCache.map(item => {
      // Parse data agen dan kontrak
      let agenNama = item.nama_agen || 'Agen Lapangan Tabagsel';
      let agenWA = item.kontak_agen || '';
      let legalitas = item.status_legalitas || 'Sertifikat Hak Milik (SHM)';
      let lokasiMaps = item.lokasi_maps || item.lokasi || '';
      let isSigned = item.is_kontrak_signed;

      if (item.catatan_admin && item.catatan_admin.startsWith('{')) {
        try {
          const parsed = JSON.parse(item.catatan_admin);
          if (parsed.nama_agen) agenNama = parsed.nama_agen;
          if (parsed.kontak_agen) agenWA = parsed.kontak_agen;
          if (parsed.status_legalitas) legalitas = parsed.status_legalitas;
          if (parsed.lokasi_maps) lokasiMaps = parsed.lokasi_maps;
          if (parsed.is_kontrak_signed !== undefined) isSigned = parsed.is_kontrak_signed;
        } catch (e) {}
      }

      const namaKlien = item.nama_pemilik || item.nama_klien || 'Klien Pemilik';
      const waKlien = item.wa_pemilik || item.kontak_pemilik || '-';
      const judulAset = item.judul_aset || item.jenis_aset || item.deskripsi_aset || 'Aset Titipan Baru';
      const hargaNet = item.harga_net || item.harga_harapan || 0;

      return `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-gold/50 transition-all space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="bg-amber-100 text-gold-dark text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <i class="fas fa-user-tie"></i> Agen Lapangan: <strong>${agenNama}</strong>
              </span>
              ${agenWA ? `<span class="text-[10px] text-slate-500 font-mono">(${agenWA})</span>` : ''}
              ${isSigned ? `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fas fa-check-circle mr-1"></i>Kontrak Sah Ditandatangani</span>` : ''}
            </div>
            <span class="text-[11px] text-slate-400 font-mono">${new Date(item.created_at || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div class="md:col-span-8 space-y-2">
              <h4 class="font-black text-navy text-base leading-snug">${judulAset}</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <p class="text-slate-600"><span class="font-bold text-slate-500">Klien (Pemilik):</span> <strong>${namaKlien}</strong></p>
                <p class="text-slate-600"><span class="font-bold text-slate-500">No. WhatsApp:</span> <a href="https://wa.me/${waKlien}" target="_blank" class="font-mono text-emerald-600 font-bold hover:underline">${waKlien}</a></p>
                <p class="text-slate-600"><span class="font-bold text-slate-500">Wilayah:</span> ${item.kabupaten || 'Tabagsel'}</p>
                <p class="text-slate-600"><span class="font-bold text-slate-500">Legalitas:</span> <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">${legalitas}</span></p>
              </div>
              ${lokasiMaps ? `
                <p class="text-xs text-slate-600">
                  <span class="font-bold text-slate-500">Titik Google Maps:</span> 
                  <a href="${lokasiMaps}" target="_blank" class="text-blue-600 hover:underline font-mono text-[11px] ml-1 inline-flex items-center gap-1 font-bold">
                    <i class="fas fa-location-dot text-rose-500"></i> Buka Titik Lokasi Presisi
                  </a>
                </p>
              ` : ''}
              ${item.catatan ? `<p class="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-600 italic">"${item.catatan}"</p>` : ''}
            </div>

            <div class="md:col-span-4 flex flex-col justify-between items-start md:items-end gap-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
              <div class="w-full md:text-right">
                <span class="text-[10px] uppercase font-bold text-slate-400">Harga Net Pemilik</span>
                <p class="text-base font-black text-navy">${formatRupiah(hargaNet)}</p>
              </div>

              <div class="w-full flex flex-col gap-2">
                <button type="button" onclick="prosesDanPajangKeWebsite('${item.id}')" class="btn-gold w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 hover:brightness-105 transition-all">
                  <i class="fas fa-store"></i> Proses & Pajang ke Website
                </button>
                <div class="flex gap-2">
                  <select onchange="updateTitipStatus('${item.id}', this.value)" class="form-input text-xs py-1 flex-1">
                    <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="disurvei" ${item.status === 'disurvei' ? 'selected' : ''}>Disurvei</option>
                    <option value="diterima" ${item.status === 'diterima' ? 'selected' : ''}>Diterima / Terpajang</option>
                    <option value="ditolak" ${item.status === 'ditolak' ? 'selected' : ''}>Ditolak</option>
                  </select>
                  <a href="https://wa.me/${waKlien}" target="_blank" class="btn-whatsapp text-xs py-1 px-3 rounded-lg flex items-center gap-1 font-bold" title="Hubungi Klien">
                    <i class="fab fa-whatsapp"></i> Klien
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading titip aset:', err);
  }
}

function prosesDanPajangKeWebsite(itemId) {
  const item = currentTitipListCache.find(i => String(i.id) === String(itemId));
  if (!item) {
    alert('Data pendataan aset tidak ditemukan.');
    return;
  }

  let agenNama = item.nama_agen || 'Agen Lapangan Tabagsel';
  let agenWA = item.kontak_agen || '';
  let legalitas = item.status_legalitas || 'Sertifikat Hak Milik (SHM)';
  let lokasiMaps = item.lokasi_maps || item.lokasi || '';

  if (item.catatan_admin && item.catatan_admin.startsWith('{')) {
    try {
      const parsed = JSON.parse(item.catatan_admin);
      if (parsed.nama_agen) agenNama = parsed.nama_agen;
      if (parsed.kontak_agen) agenWA = parsed.kontak_agen;
      if (parsed.status_legalitas) legalitas = parsed.status_legalitas;
      if (parsed.lokasi_maps) lokasiMaps = parsed.lokasi_maps;
    } catch (e) {}
  }

  const namaKlien = item.nama_pemilik || item.nama_klien || '';
  const waKlien = item.wa_pemilik || item.kontak_pemilik || '';
  const judul = item.judul_aset || item.jenis_aset || '';
  const hargaNet = parseInt(item.harga_net || item.harga_harapan || 0);
  const hargaTayang = Math.round(hargaNet * 1.025); // Tambahkan estimasi sukses fee Tabagsel Hub 2.5%

  // Buka Form Input Aset
  openAdminAssetForm();

  // Isi data publik
  const assetJudul = document.getElementById('assetJudul');
  if (assetJudul) assetJudul.value = judul;

  const assetKabupaten = document.getElementById('assetKabupaten');
  if (assetKabupaten) assetKabupaten.value = item.kabupaten || 'Kota Padangsidimpuan';

  const assetHarga = document.getElementById('assetHarga');
  if (assetHarga) assetHarga.value = hargaTayang || hargaNet;

  const assetDeskripsi = document.getElementById('assetDeskripsi');
  if (assetDeskripsi) assetDeskripsi.value = item.catatan || item.deskripsi_aset || '';

  if (item.foto_url) {
    const foto1Url = document.getElementById('assetFoto1Url');
    if (foto1Url) foto1Url.value = item.foto_url;
    const preview1 = document.getElementById('assetFoto1Preview');
    if (preview1) {
      preview1.src = item.foto_url;
      preview1.classList.remove('hidden');
    }
  }

  // Isi Brankas Rahasia (Data Pemilik & Koordinat Presisi Terkunci)
  const vaultNama = document.getElementById('vaultNamaPemilik');
  if (vaultNama) vaultNama.value = namaKlien;

  const vaultWA = document.getElementById('vaultWAPemilik');
  if (vaultWA) vaultWA.value = waKlien;

  const vaultHargaNet = document.getElementById('vaultHargaNet');
  if (vaultHargaNet) vaultHargaNet.value = hargaNet;

  const vaultGMaps = document.getElementById('vaultGMaps');
  if (vaultGMaps) vaultGMaps.value = lokasiMaps;

  const vaultLegalitas = document.getElementById('vaultLegalitas');
  if (vaultLegalitas) vaultLegalitas.value = legalitas;

  const vaultCatatan = document.getElementById('vaultCatatan');
  if (vaultCatatan) {
    vaultCatatan.value = `[SURVEYOR LAPANGAN: ${agenNama} (${agenWA})]\nStatus Kontrak: Sah & Ditandatangani Klien.\nCatatan Fisik: ${item.catatan || '-'}`;
  }

  calcKomisi();

  // Pindahkan tab aktif ke Tab 1 (Katalog & Brankas)
  const tabBtn = document.querySelector('button[onclick*="tabKatalog"]');
  if (tabBtn) switchTab('tabKatalog', tabBtn);

  // Perbarui status antrean ke disurvei
  updateTitipStatus(itemId, 'disurvei');

  showToast(`Data survei dari Agen ${agenNama} berhasil dimuat ke Form Aset & Brankas Rahasia! Silakan periksa dan klik Simpan.`, 'success');
}

async function updateTitipStatus(id, status) {
  try {
    await adminUpdateTitipAset(id, { status });
    showToast('Status titip aset diperbarui!', 'success');
  } catch (err) {
    showToast('Gagal update: ' + err.message, 'error');
  }
}

async function loadAdminSayembaraList() {
  try {
    const data = await adminFetchSayembara();
    const list = document.getElementById('adminSayembaraList');
    if (!list) return;
    list.innerHTML = data.map(item => `
      <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <span class="font-mono text-xs font-bold text-gold bg-amber-50 px-2 py-0.5 rounded">${item.kode_pencarian}</span>
          <h4 class="font-bold text-navy text-sm mt-1">${item.kriteria_spesifik}</h4>
          <p class="text-xs text-slate-500">${item.wilayah_target} | ${item.kategori}</p>
        </div>
        ${item.budget_maksimal ? `<p class="text-xs font-bold text-navy">${formatRupiah(item.budget_maksimal)}</p>` : ''}
      </div>
    `).join('');
  } catch (err) {}
}

function openSayembaraForm() {
  document.getElementById('formSayembara').reset();
  document.getElementById('sayembaraEditId').value = '';
  openModal('modalSayembaraForm');
}

async function saveSayembara(e) {
  e.preventDefault();
  try {
    const data = {
      kode_pencarian: document.getElementById('sayembaraKode').value,
      kategori: document.getElementById('sayembaraKategori').value,
      kriteria_spesifik: document.getElementById('sayembaraKriteria').value,
      wilayah_target: document.getElementById('sayembaraWilayah').value,
      budget_maksimal: document.getElementById('sayembaraBudget').value ? parseInt(document.getElementById('sayembaraBudget').value) : null,
    };
    await adminUpsertSayembara(data);
    closeModal('modalSayembaraForm');
    showToast('Sayembara disimpan!', 'success');
    await loadAdminSayembaraList();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

async function loadMitraList() {
  try {
    const data = await adminFetchAffiliates();
    const list = document.getElementById('mitraList');
    if (!list) return;
    list.innerHTML = data.map(item => `
      <div class="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <span class="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">${item.kode_mitra}</span>
          <p class="font-bold text-navy text-sm mt-1">${item.nama_mitra}</p>
          <p class="text-xs text-slate-500">${item.wa_mitra} | ${item.wilayah || '-'}</p>
        </div>
        <p class="text-xs font-bold text-gold">${item.total_referral} Referral</p>
      </div>
    `).join('');
  } catch (err) {}
}

function openMitraForm() {
  document.getElementById('formMitra').reset();
  document.getElementById('mitraEditId').value = '';
  openModal('modalMitraForm');
}

async function saveMitra(e) {
  e.preventDefault();
  try {
    const data = {
      kode_mitra: document.getElementById('mitraKode').value,
      nama_mitra: document.getElementById('mitraNama').value,
      wa_mitra: document.getElementById('mitraWA').value,
      wilayah: document.getElementById('mitraWilayah').value,
    };
    await adminUpsertAffiliate(data);
    closeModal('modalMitraForm');
    showToast('Mitra disimpan!', 'success');
    await loadMitraList();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ============================================================
// SURVEYOR TASKS
// ============================================================
async function loadSurveyorTasks() {
  try {
    const tasks = await fetchTugasSurveyor(currentUser.id);
    const list = document.getElementById('surveyorTaskList');
    const empty = document.getElementById('surveyorTaskEmpty');
    if (!list) return;

    if (tasks.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = tasks.map(task => {
      const isSelesai = task.status === 'selesai';
      const statusBadge = isSelesai
        ? '<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">✅ SELESAI</span>'
        : '<span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">⏳ DITUGASKAN</span>';

      return `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div class="flex justify-between items-start">
            ${statusBadge}
            <span class="text-xs text-slate-400 font-mono font-bold">${task.kode_aset || '-'}</span>
          </div>
          <div>
            <p class="font-bold text-navy text-sm">${task.nama_klien || 'Klien Tabagsel Hub'} (${task.wa_klien || '-'})</p>
            <p class="text-xs text-slate-600 mt-1"><i class="fas fa-map-marker-alt text-rose-500 mr-1.5"></i>${task.lokasi_survei || '-'}</p>
            ${task.instruksi ? `<p class="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2 font-mono"><strong class="text-navy">Instruksi:</strong> ${task.instruksi}</p>` : ''}
          </div>
          
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
            ${isSelesai ? `
              <span class="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <i class="fas fa-check-circle"></i> Tugas Telah Diselesaikan
              </span>
            ` : `
              <button onclick="completeSurveyorTask('${task.id}')" class="btn-gold text-xs py-2 px-4 rounded-xl font-bold shadow flex items-center gap-1.5">
                <i class="fas fa-check"></i> Selesaikan Tugas
              </button>
            `}
            ${task.wa_klien ? `
              <a href="https://wa.me/${task.wa_klien.replace(/\D/g, '')}?text=Halo%20${encodeURIComponent(task.nama_klien || 'Bpk/Ibu')},%20saya%20Surveyor%20resmi%20dari%20Tabagsel%20Hub%20siap%20mengecek%20unit%20Anda." target="_blank" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <i class="fab fa-whatsapp text-sm"></i> Chat Klien
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function completeSurveyorTask(taskId) {
  try {
    await updateTugasSurvei(taskId, { status: 'selesai' });
    showToast('Tugas survei selesai!', 'success');
    await loadSurveyorTasks();
  } catch (err) {
    showToast('Gagal: ' + err.message, 'error');
  }
}

// ============================================================
// TAB 7: MANAJEMEN TIM, KARYAWAN & HAK AKSES STAF
// ============================================================
let allStaffData = [];

async function loadStaffList() {
  try {
    allStaffData = await adminFetchAllStaff();
    renderStaffList();
  } catch (err) {
    console.error('Error loading staff list:', err);
  }
}

function renderStaffList() {
  const tableBody = document.getElementById('staffTableBody');
  const emptyNotice = document.getElementById('staffEmptyNotice');
  const badgeTotal = document.getElementById('badgeTotalStaff');
  if (!tableBody) return;

  const searchQuery = (document.getElementById('searchStaffInput')?.value || '').toLowerCase().trim();

  const filteredStaff = allStaffData.filter(staff => {
    if (!searchQuery) return true;
    const matchName = (staff.full_name || '').toLowerCase().includes(searchQuery);
    const matchEmail = (staff.email || '').toLowerCase().includes(searchQuery);
    const matchPhone = (staff.phone || '').toLowerCase().includes(searchQuery);
    const matchRole = (staff.role || '').toLowerCase().includes(searchQuery);
    return matchName || matchEmail || matchPhone || matchRole;
  });

  if (badgeTotal) {
    badgeTotal.textContent = `${allStaffData.length} Anggota`;
  }

  if (filteredStaff.length === 0) {
    tableBody.innerHTML = '';
    if (emptyNotice) emptyNotice.classList.remove('hidden');
    return;
  }

  if (emptyNotice) emptyNotice.classList.add('hidden');

  tableBody.innerHTML = filteredStaff.map(staff => {
    const isSuperAdmin = staff.role === 'super_admin';
    const roleBadge = isSuperAdmin
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-gold-dark border border-amber-300">
           <i class="fas fa-crown text-amber-500"></i> Super Admin
         </span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
           <i class="fas fa-motorcycle text-sky-600"></i> Surveyor Lapangan
         </span>`;

    const statusBadge = staff.is_active
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Aktif
         </span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
           <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
         </span>`;

    const isCurrentLoggedIn = currentUser && (currentUser.id === staff.id || currentUser.email === staff.email);

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full ${isSuperAdmin ? 'bg-amber-100 text-gold-dark' : 'bg-sky-100 text-sky-700'} flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              ${(staff.full_name || 'U').charAt(0)}
            </div>
            <div>
              <p class="font-bold text-navy leading-tight">${staff.full_name || 'Tanpa Nama'}</p>
              <p class="text-slate-400 font-mono text-[10px] mt-0.5">${staff.phone || '-'}</p>
            </div>
          </div>
        </td>
        <td class="p-3.5 font-mono text-[11px] text-slate-600">
          ${staff.email}
          ${isCurrentLoggedIn ? '<span class="ml-1 text-[9px] font-bold bg-navy text-white px-1.5 py-0.5 rounded">Akun Anda</span>' : ''}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          ${roleBadge}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="toggleStaffStatus('${staff.id}', ${staff.is_active ? 'true' : 'false'})" class="px-2.5 py-1 rounded-lg ${staff.is_active ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'} font-bold text-[10px] transition-all" title="${staff.is_active ? 'Nonaktifkan Akses' : 'Aktifkan Akses'}">
              <i class="fas ${staff.is_active ? 'fa-user-lock' : 'fa-user-check'} mr-1"></i>${staff.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button type="button" onclick="toggleStaffRole('${staff.id}', '${staff.role}')" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] transition-all" title="Ubah Hak Akses">
              <i class="fas fa-arrows-rotate"></i>
            </button>
            ${!isCurrentLoggedIn ? `
              <button type="button" onclick="deleteStaff('${staff.id}', '${staff.full_name || staff.email}')" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] transition-all" title="Hapus Anggota">
                <i class="fas fa-trash-alt"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function onStaffRoleSelectChange() {
  const role = document.getElementById('staffRole')?.value;
  const noteBox = document.getElementById('staffRoleNote');
  if (!noteBox) return;

  if (role === 'super_admin') {
    noteBox.className = 'p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1';
    noteBox.innerHTML = `
      <p class="font-bold flex items-center gap-1 text-gold-dark"><i class="fas fa-crown text-amber-500"></i>Akses Super Admin (Akses Penuh):</p>
      <p>Karyawan memiliki izin melihat <strong>Brankas Rahasia Pemilik</strong>, <strong>Log Keuangan</strong>, <strong>Penerbitan E-Faktur</strong>, serta menambah atau menghapus aset. Berikan hanya kepada mitra direksi atau manajer terpercaya.</p>
    `;
  } else {
    noteBox.className = 'p-3 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-800 space-y-1';
    noteBox.innerHTML = `
      <p class="font-bold flex items-center gap-1 text-sky-700"><i class="fas fa-shield-alt text-sky-600"></i>Akses Surveyor (Aman & Terproteksi):</p>
      <p>Karyawan hanya bisa melihat tugas lapangan miliknya dan upload foto kondisi fisik. Brankas rahasia pemilik, nomor HP pemilik, margin deal, dan pembukuan keuangan diblokir 100%.</p>
    `;
  }
}

function openTambahStafModal() {
  const form = document.getElementById('formTambahStaf');
  if (form) form.reset();
  onStaffRoleSelectChange();
  openModal('modalTambahStaf');
}

async function submitTambahStaf(e) {
  e.preventDefault();
  const fullName = (document.getElementById('staffFullName')?.value || '').trim();
  const phone = (document.getElementById('staffPhone')?.value || '').trim();
  const role = document.getElementById('staffRole')?.value || 'surveyor';
  const email = (document.getElementById('staffEmail')?.value || '').trim().toLowerCase();
  const password = document.getElementById('staffPassword')?.value || '';

  if (!fullName || !email || !password) {
    showToast('Harap lengkapi nama, email, dan password.', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitStaf');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menyimpan...';
  }

  try {
    await adminCreateStaff({
      full_name: fullName,
      phone: phone,
      role: role,
      email: email,
      password: password,
      is_active: true
    });

    showToast(`Akun ${fullName} (${role === 'super_admin' ? 'Super Admin' : 'Surveyor'}) berhasil dibuat!`, 'success');
    closeModal('modalTambahStaf');
    await loadStaffList();
  } catch (err) {
    showToast('Gagal membuat staf: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Simpan & Buat Akun';
    }
  }
}

async function toggleStaffStatus(staffId, currentStatus) {
  try {
    await adminUpdateStaff(staffId, { is_active: !currentStatus });
    showToast(`Status staf berhasil diubah menjadi ${!currentStatus ? 'Aktif' : 'Nonaktif'}!`, 'success');
    await loadStaffList();
  } catch (err) {
    showToast('Gagal mengubah status: ' + err.message, 'error');
  }
}

async function toggleStaffRole(staffId, currentRole) {
  const newRole = currentRole === 'super_admin' ? 'surveyor' : 'super_admin';
  const roleLabel = newRole === 'super_admin' ? 'Super Admin' : 'Surveyor Lapangan';
  
  if (!confirm(`Ubah hak akses staf ini menjadi "${roleLabel}"?`)) {
    return;
  }

  try {
    await adminUpdateStaff(staffId, { role: newRole });
    showToast(`Hak akses berhasil diubah menjadi ${roleLabel}!`, 'success');
    await loadStaffList();
  } catch (err) {
    showToast('Gagal mengubah hak akses: ' + err.message, 'error');
  }
}

async function deleteStaff(staffId, staffName) {
  if (!confirm(`Yakin ingin menghapus akun anggota "${staffName}"? Akses login akan ditutup permanen.`)) {
    return;
  }

  try {
    await adminDeleteStaff(staffId);
    showToast(`Akun staf "${staffName}" berhasil dihapus.`, 'info');
    await loadStaffList();
  } catch (err) {
    showToast('Gagal menghapus staf: ' + err.message, 'error');
  }
}

// ============================================================
// UI HELPERS (MODALS & TOAST)
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
  setTimeout(() => toast.classList.remove('show'), 4000);
}
