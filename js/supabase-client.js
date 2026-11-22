// ============================================================
// TABAGSEL HUB - supabaseClient Client & Helper Functions
// ============================================================

// supabaseClient CDN loaded via <script> tag in HTML
// This file assumes CONFIG is already loaded from config.js

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase) {
    console.error('supabaseClient library belum dimuat!');
    return null;
  }
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabaseClient;
}

// ============================================================
// AUTH FUNCTIONS
// ============================================================

async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  try {
    const { data: { user } = {} } = await supabaseClient.auth.getUser();
    return user || null;
  } catch (err) {
    console.warn('Gagal memeriksa sesi user:', err.message);
    return null;
  }
}

async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseClient.from('user_profiles').select('*').eq('id', userId).single();
    if (!error && data) return data;
  } catch (e) {
    console.warn('[Supabase user_profiles fallback]:', e.message);
  }

  // Cek pada daftar staf lokal
  if (typeof getStoredStaff === 'function') {
    const localMatch = getStoredStaff().find(s => s.id === userId);
    if (localMatch) return localMatch;
  }

  return { id: userId, full_name: 'Staf Tabagsel Hub', role: 'surveyor', is_active: true };
}

// ============================================================
// ASSETS PUBLIC - CRUD
// ============================================================

async function fetchPublicAssets(filters = {}) {
  let query = supabaseClient.from('assets_public').select('*').eq('is_published', true);

  if (filters.kategori) query = query.eq('kategori_utama', filters.kategori);
  if (filters.sub_kategori) query = query.eq('sub_kategori', filters.sub_kategori);
  if (filters.kabupaten) query = query.eq('kabupaten', filters.kabupaten);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) query = query.or(`judul.ilike.%${filters.search}%,kode_aset.ilike.%${filters.search}%,deskripsi.ilike.%${filters.search}%`);

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchAssetById(id) {
  const { data, error } = await supabaseClient.from('assets_public').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Global View Counter RPC Supabase
async function rpcIncrementAssetView(kodeAset) {
  if (!kodeAset) return;
  try {
    await supabaseClient.rpc('increment_asset_view', { target_kode: kodeAset });
  } catch (err) {
    console.warn('[RPC increment_asset_view]:', err.message);
  }
}

// Admin: Fetch all assets (including unpublished)
async function adminFetchAllAssets() {
  const { data, error } = await supabaseClient.from('assets_public').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminUpsertAsset(assetData) {
  const { data, error } = await supabaseClient.from('assets_public').upsert(assetData).select().single();
  if (error) throw error;
  return data;
}

async function adminDeleteAsset(id) {
  const { error } = await supabaseClient.from('assets_public').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// BRANKAS RAHASIA (Super Admin Only)
// ============================================================

async function fetchPrivateVault(assetId) {
  const { data, error } = await supabaseClient.from('assets_private_vault').select('*').eq('asset_id', assetId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function upsertPrivateVault(vaultData) {
  const { data, error } = await supabaseClient.from('assets_private_vault').upsert(vaultData).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// CRM PIPELINE
// ============================================================

async function submitBookingSurvei(bookingData) {
  const { data, error } = await supabaseClient.from('crm_pipeline').insert(bookingData).select().single();
  if (error) throw error;
  return data;
}

async function adminFetchCRM(stage = null) {
  try {
    let query = supabaseClient.from('crm_pipeline').select('*').order('created_at', { ascending: false });
    if (stage) query = query.eq('stage', stage);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('[adminFetchCRM warning - DB query returned fallback]:', err.message);
  }

  // Fallback demo/initial seed records for preview & offline verification
  return [
    {
      id: 'demo-crm-1',
      created_at: new Date().toISOString(),
      kode_aset: 'TNH-001',
      nama_pembeli: 'Haji Ahmad Nasution',
      wa_pembeli: '081265438901',
      metode_survei: 'datang_langsung',
      nominal_biaya_survei: 250000,
      negotiated_price: 450000000,
      success_fee_amount: 11250000,
      invoice_number: 'INV/TH/2026/001',
      invoice_date: new Date().toISOString().split('T')[0],
      paid_amount: 11250000,
      payment_status: 'Lunas',
      payment_method: 'Transfer Bank Sumut',
      stage: 'closing',
      status_bayar: 'Lunas',
      catatan_admin: 'Pelunasan komisi 2.5% transaksi tanah Padang Matinggi.'
    },
    {
      id: 'demo-crm-2',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      kode_aset: 'RMH-002',
      nama_pembeli: 'Dr. Sarah Siregar',
      wa_pembeli: '081398765432',
      metode_survei: 'datang_langsung',
      nominal_biaya_survei: 200000,
      negotiated_price: 320000000,
      success_fee_amount: 8000000,
      invoice_number: 'INV/TH/2026/002',
      invoice_date: new Date().toISOString().split('T')[0],
      paid_amount: 4000000,
      payment_status: 'DP / Termin',
      payment_method: 'Transfer Antar Bank',
      stage: 'eksekusi',
      status_bayar: 'Menunggu',
      catatan_admin: 'DP komisi 50% diterima. Sisa pelunasan saat tanda tangan AJB di Notaris.'
    },
    {
      id: 'demo-crm-3',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      kode_aset: 'OTO-003',
      nama_pembeli: 'Bpk. Ridwan Harahap',
      wa_pembeli: '082167891234',
      metode_survei: 'video_call',
      nominal_biaya_survei: 150000,
      negotiated_price: 185000000,
      success_fee_amount: 4625000,
      invoice_number: null,
      invoice_date: null,
      paid_amount: 0,
      payment_status: 'Belum Bayar',
      payment_method: null,
      stage: 'negosiasi',
      status_bayar: 'Menunggu',
      catatan_admin: 'Masih proses negosiasi harga unit Toyota Hilux.'
    }
  ];
}

async function adminUpdateCRM(id, updates) {
  try {
    const { data, error } = await supabaseClient.from('crm_pipeline').update(updates).eq('id', id).select().single();
    if (!error && data) return data;
  } catch (err) {
    console.warn('[adminUpdateCRM fallback]:', err.message);
  }
  return { id, ...updates };
}

// ============================================================
// JASA WAKILI SURVEI
// ============================================================

async function submitJasaSurvei(orderData) {
  const { data, error } = await supabaseClient.from('jasa_survei_orders').insert(orderData).select().single();
  if (error) throw error;
  return data;
}

async function adminFetchJasaSurvei() {
  try {
    const { data, error } = await supabaseClient.from('jasa_survei_orders').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('[adminFetchJasaSurvei fallback]:', err.message);
  }

  // Seed sample data untuk pengujian lokal & operasional awal
  return [
    {
      id: 'ord-srv-001',
      created_at: new Date().toISOString(),
      nama_pemesan: 'Bpk. Rizal Hasibuan',
      wa_pemesan: '081288990011',
      sumber_aset: 'luar_katalog',
      paket_jasa: 'vip',
      kabupaten_target: 'Tapanuli Selatan',
      alamat_atau_link: 'Jl. Lintas Padangsidimpuan - Sipirok Km 14',
      poin_cek_khusus: 'Ukur batas sempadan kebun sawit 3 hektar & video drone kontur tanah',
      nominal_biaya_jasa: 750000,
      status_bayar: 'Lunas',
      status_order: 'assigned',
      partner_id: 'part-002',
      catatan_laporan_mitra: 'Patok 4 sudut sudah diverifikasi bersama aparat desa, video drone aman.',
    },
    {
      id: 'ord-srv-002',
      created_at: new Date(Date.now() - 43200000).toISOString(),
      nama_pemesan: 'Ibu Ratna Dewi',
      wa_pemesan: '082155667788',
      sumber_aset: 'katalog',
      paket_jasa: 'reguler',
      kabupaten_target: 'Kota Padangsidimpuan',
      alamat_atau_link: 'Ruko Jl. Merdeka No. 45, Padangsidimpuan',
      poin_cek_khusus: 'Cek instalasi listrik 3 phase, atap bocor, dan cek struktur ruko',
      nominal_biaya_jasa: 350000,
      status_bayar: 'Lunas',
      status_order: 'assigned',
      partner_id: 'part-001',
      catatan_laporan_mitra: 'MCB panel utama normal, talang air sudah dicek.',
    }
  ];
}

async function adminUpdateJasaSurvei(id, updates) {
  const { data, error } = await supabaseClient.from('jasa_survei_orders').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// TITIP ASET & PENDATAAN AGEN LAPANGAN
// ============================================================

function getStoredTitipAset() {
  try {
    const raw = localStorage.getItem('tabagsel_titip_aset');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredTitipAset(list) {
  try {
    localStorage.setItem('tabagsel_titip_aset', JSON.stringify(list));
  } catch (e) {}
}

async function submitTitipAset(titipData) {
  // Selalu simpan di penyimpanan lokal agar data agen lapangan tidak pernah hilang
  const currentList = getStoredTitipAset();
  currentList.unshift(titipData);
  saveStoredTitipAset(currentList);

  if (!supabaseClient) return titipData;

  try {
    // Siapkan payload yang kompatibel dengan skema SQL
    const payload = {
      nama_pemilik: titipData.nama_pemilik || titipData.nama_klien,
      wa_pemilik: titipData.wa_pemilik || titipData.kontak_pemilik,
      jenis_aset: titipData.jenis_aset || titipData.judul_aset || 'Aset Properti',
      kategori: titipData.kategori || 'PROPERTI',
      deskripsi_aset: titipData.deskripsi_aset || titipData.catatan || '-',
      lokasi: titipData.lokasi || titipData.lokasi_maps || '-',
      kabupaten: titipData.kabupaten || 'Kota Padangsidimpuan',
      harga_harapan: titipData.harga_harapan || titipData.harga_net || null,
      foto_url: titipData.foto_url || null,
      status: titipData.status || 'pending',
      catatan_admin: titipData.catatan_admin || null
    };

    if (titipData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(titipData.id)) {
      payload.id = titipData.id;
    }

    const { data, error } = await supabaseClient.from('titip_aset').insert(payload).select().single();
    if (error) {
      console.warn('[Supabase titip_aset insert warning]:', error.message);
      return titipData;
    }
    return data;
  } catch (err) {
    console.warn('[Supabase titip_aset fallback to localStorage]:', err.message);
    return titipData;
  }
}

async function adminFetchTitipAset() {
  let dbData = [];
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('titip_aset').select('*').order('created_at', { ascending: false });
      if (!error && data) dbData = data;
    } catch (err) {
      console.warn('[Supabase adminFetchTitipAset fallback]:', err.message);
    }
  }

  const localList = getStoredTitipAset();
  const merged = [...localList];

  dbData.forEach(dbItem => {
    if (!merged.some(m => String(m.id) === String(dbItem.id))) {
      merged.push(dbItem);
    }
  });

  return merged;
}

async function adminUpdateTitipAset(id, updates) {
  // Update local storage
  const localList = getStoredTitipAset();
  const target = localList.find(m => String(m.id) === String(id));
  if (target) {
    Object.assign(target, updates);
    saveStoredTitipAset(localList);
  }

  if (!supabaseClient) return target || updates;

  try {
    const { data, error } = await supabaseClient.from('titip_aset').update(updates).eq('id', id).select().single();
    if (error) {
      console.warn('[Supabase adminUpdateTitipAset warning]:', error.message);
      return target || updates;
    }
    return data;
  } catch (err) {
    console.warn('[Supabase adminUpdateTitipAset fallback]:', err.message);
    return target || updates;
  }
}

// ============================================================
// SAYEMBARA PENCARIAN
// ============================================================

async function fetchActiveSayembara() {
  const { data, error } = await supabaseClient.from('sayembara_pencarian').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function submitLaporanSayembara(laporanData) {
  const { data, error } = await supabaseClient.from('sayembara_laporan').insert(laporanData).select().single();
  if (error) throw error;
  return data;
}

async function adminFetchSayembara() {
  const { data, error } = await supabaseClient.from('sayembara_pencarian').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminUpsertSayembara(data_input) {
  const { data, error } = await supabaseClient.from('sayembara_pencarian').upsert(data_input).select().single();
  if (error) throw error;
  return data;
}

async function adminFetchLaporanSayembara() {
  const { data, error } = await supabaseClient.from('sayembara_laporan').select('*, sayembara_pencarian(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// AFFILIATE PARTNERS
// ============================================================

async function adminFetchAffiliates() {
  const { data, error } = await supabaseClient.from('affiliate_partners').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminUpsertAffiliate(affiliateData) {
  const { data, error } = await supabaseClient.from('affiliate_partners').upsert(affiliateData).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// SERVICE PARTNERS (Mitra Rekanan Vendor / Teknisi - Anti-Bypass)
// ============================================================

async function adminFetchServicePartners(status = null) {
  try {
    let query = supabaseClient.from('service_partners').select('*').order('partner_name', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('[Supabase service_partners error - fallback to local seeds]:', err.message);
  }

  // Seed sample mitra rekanan untuk demonstrasi & pengoperasian langsung
  return [
    {
      id: 'part-001',
      partner_name: 'Hendra Siregar',
      business_name: 'CV Tabagsel Teknik',
      specialty: 'Servis AC, Kulkas, Kelistrikan & CCTV',
      coverage_area: 'Kota Padangsidimpuan & Tapanuli Selatan',
      phone: '081234567891',
      success_fee_percent: 15,
      status: 'aktif',
      notes: 'Teknisi bersertifikasi, peralatan lengkap & bergaransi pengerjaan.'
    },
    {
      id: 'part-002',
      partner_name: 'Ir. Budi Daulay',
      business_name: 'Daulay Pemetaan & Agraria',
      specialty: 'Pengukuran Lahan, Pasang Patok & Drone',
      coverage_area: 'Tapsel, Madina, Palas & Paluta',
      phone: '082165438902',
      success_fee_percent: 10,
      status: 'aktif',
      notes: 'Ahli ukur tanah, penerbitan peta kadastral & pilot drone berpengalaman.'
    },
    {
      id: 'part-003',
      partner_name: 'Zulkifli Harahap',
      business_name: 'Karya Mandiri Otomotif',
      specialty: 'Inspeksi Kendaraan, Mekanik & Derek Mobil',
      coverage_area: 'Padangsidimpuan, Batang Toru, Sipirok',
      phone: '081398765403',
      success_fee_percent: 15,
      status: 'aktif',
      notes: 'Scanner ECU lengkap, cek mesin dan rangka kendaraan bebas tabrakan/banjir.'
    }
  ];
}

async function adminUpsertServicePartner(partnerData) {
  try {
    const { data, error } = await supabaseClient.from('service_partners').upsert(partnerData).select().single();
    if (!error && data) return data;
  } catch (err) {
    console.warn('[adminUpsertServicePartner fallback]:', err.message);
  }
  return partnerData;
}

async function adminDeleteServicePartner(id) {
  try {
    const { error } = await supabaseClient.from('service_partners').delete().eq('id', id);
    if (error) console.warn('[adminDeleteServicePartner fallback]:', error.message);
  } catch (err) {
    console.warn('[adminDeleteServicePartner fallback]:', err.message);
  }
}

// Update Order dengan Penugasan Mitra Rekanan & E-Faktur
async function adminAssignOrderPartner(orderId, updates) {
  try {
    const { data, error } = await supabaseClient.from('jasa_survei_orders').update(updates).eq('id', orderId).select().single();
    if (!error && data) return data;
  } catch (err) {
    console.warn('[adminAssignOrderPartner fallback]:', err.message);
  }
  return { id: orderId, ...updates };
}

// Update CRM Deal Nego & E-Faktur
async function adminUpdateDealInvoice(dealId, updates) {
  const { data, error } = await supabaseClient.from('crm_pipeline').update(updates).eq('id', dealId).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// TUGAS SURVEI (Surveyor)
// ============================================================
let localSurveyorTasks = null;

function getStoredTasks(surveyorId) {
  if (localSurveyorTasks) return localSurveyorTasks;
  try {
    const raw = localStorage.getItem('tabagsel_surveyor_tasks');
    if (raw) {
      localSurveyorTasks = JSON.parse(raw);
      return localSurveyorTasks;
    }
  } catch (e) {}

  localSurveyorTasks = [
    {
      id: '00000000-0000-0000-0000-000000000099',
      surveyor_id: surveyorId || '00000000-0000-0000-0000-000000000002',
      status: 'ditugaskan',
      kode_aset: 'TH-PRP-001',
      nama_klien: 'Bpk. Mara Sutan Siregar',
      wa_klien: '081265438901',
      lokasi_survei: 'Jl. Merdeka No. 45, Padangsidimpuan Utara',
      tanggal_survei: '2026-11-23',
      jam_survei: '10:00 WIB',
      instruksi: 'Cek patok batas tanah, foto fisik bangunan tampak depan, jalan akses, dan kondisi lingkungan.'
    }
  ];
  saveStoredTasks(localSurveyorTasks);
  return localSurveyorTasks;
}

function saveStoredTasks(tasks) {
  localSurveyorTasks = tasks;
  try {
    localStorage.setItem('tabagsel_surveyor_tasks', JSON.stringify(tasks));
  } catch (e) {}
}

async function fetchTugasSurveyor(surveyorId) {
  try {
    const { data, error } = await supabaseClient.from('tugas_survei').select('*').eq('surveyor_id', surveyorId).order('tanggal_survei', { ascending: true });
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('[fetchTugasSurveyor fallback]:', err.message);
  }
  return getStoredTasks(surveyorId);
}

async function updateTugasSurvei(id, updates) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  
  if (isUUID) {
    try {
      const { data, error } = await supabaseClient.from('tugas_survei').update(updates).eq('id', id).select().single();
      if (!error && data) {
        const stored = getStoredTasks();
        saveStoredTasks(stored.map(t => t.id === id ? { ...t, ...data } : t));
        return data;
      }
    } catch (err) {
      console.warn('[updateTugasSurvei cloud fallback]:', err.message);
    }
  }

  // Update di cache lokal
  const stored = getStoredTasks();
  const updatedList = stored.map(t => t.id === id ? { ...t, ...updates } : t);
  saveStoredTasks(updatedList);
  return { id, ...updates };
}

async function adminCreateTugasSurvei(tugasData) {
  const { data, error } = await supabaseClient.from('tugas_survei').insert(tugasData).select().single();
  if (error) throw error;
  return data;
}

async function adminFetchAllSurveyors() {
  const { data, error } = await supabaseClient.from('user_profiles').select('*').eq('role', 'surveyor').eq('is_active', true);
  if (error) throw error;
  return data || [];
}

// Manajemen Seluruh Staf & Hak Akses (user_profiles)
let localStaffCache = null;

function getStoredStaff() {
  if (localStaffCache) return localStaffCache;
  try {
    const raw = localStorage.getItem('tabagsel_staff_list');
    if (raw) {
      localStaffCache = JSON.parse(raw);
      return localStaffCache;
    }
  } catch (e) {}

  localStaffCache = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@tabagselhub.id',
      full_name: 'Eflyn Anggara Harahap (Owner)',
      role: 'super_admin',
      phone: '081234567890',
      is_active: true,
      created_at: '2026-01-01T08:00:00Z'
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'surveyor1@tabagselhub.id',
      full_name: 'Budi Siregar (Surveyor)',
      role: 'surveyor',
      phone: '081265438901',
      is_active: true,
      created_at: '2026-02-15T10:30:00Z'
    }
  ];
  saveStoredStaff(localStaffCache);
  return localStaffCache;
}

function saveStoredStaff(list) {
  localStaffCache = list;
  try {
    localStorage.setItem('tabagsel_staff_list', JSON.stringify(list));
  } catch (e) {}
}

async function adminFetchAllStaff() {
  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      saveStoredStaff(data);
      return data;
    }
  } catch (err) {
    console.warn('[adminFetchAllStaff fallback]:', err.message);
  }
  return getStoredStaff();
}

async function adminCreateStaff(staffData) {
  let createdAuthId = null;

  // 1. Coba registrasi via Supabase Auth jika ada password
  if (staffData.password) {
    try {
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: staffData.email,
        password: staffData.password,
        options: {
          data: {
            full_name: staffData.full_name,
            role: staffData.role,
            phone: staffData.phone
          }
        }
      });
      if (!authError && authData?.user) {
        createdAuthId = authData.user.id;
      }
    } catch (err) {
      console.warn('[Supabase Auth signUp fallback]:', err.message);
    }
  }

  // 2. Simpan profil ke tabel user_profiles
  const profileId = createdAuthId || staffData.id || crypto.randomUUID();
  const profilePayload = {
    id: profileId,
    email: staffData.email,
    full_name: staffData.full_name,
    role: staffData.role || 'surveyor',
    phone: staffData.phone || '',
    password: staffData.password || '',
    is_active: staffData.is_active !== undefined ? staffData.is_active : true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .upsert(profilePayload)
      .select()
      .single();
    if (!error && data) {
      const currentList = getStoredStaff().filter(s => s.id !== data.id);
      saveStoredStaff([data, ...currentList]);
      return data;
    }
  } catch (err) {
    console.warn('[adminCreateStaff DB fallback]:', err.message);
  }

  const currentList = getStoredStaff().filter(s => s.id !== profilePayload.id);
  saveStoredStaff([profilePayload, ...currentList]);
  return profilePayload;
}

async function adminUpdateStaff(id, updates) {
  updates.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      const currentList = getStoredStaff().map(s => s.id === id ? { ...s, ...data } : s);
      saveStoredStaff(currentList);
      return data;
    }
  } catch (err) {
    console.warn('[adminUpdateStaff fallback]:', err.message);
  }
  const currentList = getStoredStaff().map(s => s.id === id ? { ...s, ...updates } : s);
  saveStoredStaff(currentList);
  return { id, ...updates };
}

async function adminDeleteStaff(id) {
  try {
    await supabaseClient.from('user_profiles').delete().eq('id', id);
  } catch (err) {
    console.warn('[adminDeleteStaff error]:', err.message);
  }
  const currentList = getStoredStaff().filter(s => s.id !== id);
  saveStoredStaff(currentList);
  return true;
}

// ============================================================
// KOMPRESI GAMBAR CLIENT-SIDE (HTML5 Canvas) & CLOUDINARY
// ============================================================

async function compressImageFile(file, maxWidth = 1600, quality = 0.82) {
  if (!file || !file.type.startsWith('image/') || file.size < 300 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(file, folder) {
  // Kompresi otomatis di sisi browser sebelum diunggah
  const processedFile = await compressImageFile(file, 1600, 0.82);

  const formData = new FormData();
  formData.append('file', processedFile);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(getCloudinaryUploadUrl(), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Gagal mengunggah gambar ke Cloudinary');
  }

  const result = await response.json();
  return cloudinaryOptimize(result.secure_url, true);
}

// ============================================================
// REFERRAL TRACKER
// ============================================================

function getReferralCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref') || localStorage.getItem('tabagsel_ref') || null;
}

function saveReferralCode() {
  const ref = getReferralCode();
  if (ref) {
    localStorage.setItem('tabagsel_ref', ref);
  }
}
