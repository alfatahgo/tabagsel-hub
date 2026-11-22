-- ============================================================
-- TABAGSEL HUB - Skema Database Supabase
-- Platform Jual-Beli, Sewa, dan Jasa Survei Properti & Otomotif
-- Wilayah: Kota Padangsidimpuan, Tapanuli Selatan, 
--          Mandailing Natal, Padang Lawas, Padang Lawas Utara
-- ============================================================

-- ============================================================
-- 1. TABEL PROFIL PENGGUNA (Role-Based Access Control)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'surveyor')),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. TABEL ASET PUBLIK (Data yang ditampilkan ke publik)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets_public (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_aset TEXT UNIQUE NOT NULL,
  kategori_utama TEXT NOT NULL CHECK (kategori_utama IN ('PROPERTI', 'OTOMOTIF', 'JASA_SERVIS')),
  sub_kategori TEXT NOT NULL,
  judul TEXT NOT NULL,
  kabupaten TEXT NOT NULL,
  kecamatan TEXT,
  harga_tayang BIGINT NOT NULL,
  satuan_harga TEXT DEFAULT 'Total',
  spesifikasi JSONB DEFAULT '{}',
  deskripsi TEXT,
  foto_utama TEXT,
  foto_kedua TEXT,
  link_instagram TEXT,
  link_tiktok TEXT,
  link_facebook TEXT,
  link_youtube TEXT,
  views_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Tersedia' CHECK (status IN ('Tersedia', 'Negosiasi', 'Terjual/Tersewa')),
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. BRANKAS RAHASIA PEMILIK (Hanya super_admin!)
-- ============================================================
CREATE TABLE IF NOT EXISTS assets_private_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets_public(id) ON DELETE CASCADE,
  nama_pemilik TEXT NOT NULL,
  wa_pemilik TEXT NOT NULL,
  harga_net_pemilik BIGINT NOT NULL,
  link_gmaps_presisi TEXT,
  status_legalitas TEXT,
  link_arsip_gdrive TEXT,
  catatan_internal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CRM PIPELINE PEMBELI & PEMBUKUAN KEUANGAN
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets_public(id) ON DELETE SET NULL,
  kode_aset TEXT,
  nama_pembeli TEXT NOT NULL,
  wa_pembeli TEXT NOT NULL,
  metode_survei TEXT CHECK (metode_survei IN ('datang_langsung', 'video_call')),
  tanggal_survei DATE,
  jam_survei TEXT,
  nominal_biaya_survei BIGINT DEFAULT 0,
  bukti_transfer_url TEXT,
  status_bayar TEXT DEFAULT 'Menunggu' CHECK (status_bayar IN ('Menunggu', 'Lunas', 'Ditolak')),
  kode_voucher TEXT UNIQUE,
  stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'jadwal', 'negosiasi', 'eksekusi', 'closing', 'batal')),
  surveyor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  catatan_admin TEXT,
  kode_mitra TEXT,
  negotiated_price BIGINT DEFAULT 0,
  success_fee_amount BIGINT DEFAULT 0,
  invoice_number TEXT,
  invoice_date DATE,
  paid_amount BIGINT DEFAULT 0,
  payment_status TEXT DEFAULT 'Belum Bayar',
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ORDER JASA WAKILI SURVEI (TITIP CEK ASET)
-- ============================================================
CREATE TABLE IF NOT EXISTS jasa_survei_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_pemesan TEXT NOT NULL,
  wa_pemesan TEXT NOT NULL,
  sumber_aset TEXT NOT NULL CHECK (sumber_aset IN ('katalog', 'luar_katalog')),
  asset_id UUID REFERENCES assets_public(id) ON DELETE SET NULL,
  paket_jasa TEXT NOT NULL CHECK (paket_jasa IN ('reguler', 'vip')),
  kabupaten_target TEXT NOT NULL,
  alamat_atau_link TEXT,
  poin_cek_khusus TEXT,
  nominal_biaya_jasa BIGINT DEFAULT 0,
  bukti_transfer_url TEXT,
  status_bayar TEXT DEFAULT 'Menunggu' CHECK (status_bayar IN ('Menunggu', 'Lunas', 'Ditolak')),
  surveyor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status_order TEXT DEFAULT 'pending' CHECK (status_order IN ('pending', 'verified', 'assigned', 'in_progress', 'completed', 'cancelled')),
  laporan_url TEXT,
  ringkasan_laporan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ANTREAN TITIP JUAL / SEWA ASET
-- ============================================================
CREATE TABLE IF NOT EXISTS titip_aset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_pemilik TEXT NOT NULL,
  wa_pemilik TEXT NOT NULL,
  jenis_aset TEXT NOT NULL,
  kategori TEXT NOT NULL,
  deskripsi_aset TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  kabupaten TEXT NOT NULL,
  harga_harapan BIGINT,
  foto_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'disurvei', 'diterima', 'ditolak')),
  catatan_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. SAYEMBARA PENCARIAN (Buyer's Bounty Board)
-- ============================================================
CREATE TABLE IF NOT EXISTS sayembara_pencarian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_pencarian TEXT UNIQUE NOT NULL,
  kategori TEXT NOT NULL,
  kriteria_spesifik TEXT NOT NULL,
  wilayah_target TEXT NOT NULL,
  budget_maksimal BIGINT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel laporan aset cocok dari warga/mitra
CREATE TABLE IF NOT EXISTS sayembara_laporan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sayembara_id UUID NOT NULL REFERENCES sayembara_pencarian(id) ON DELETE CASCADE,
  nama_pelapor TEXT NOT NULL,
  wa_pelapor TEXT NOT NULL,
  deskripsi_aset TEXT NOT NULL,
  lokasi_aset TEXT,
  foto_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'ditolak')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. MITRA AFILIASI LOKAL
-- ============================================================
CREATE TABLE IF NOT EXISTS affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_mitra TEXT UNIQUE NOT NULL,
  nama_mitra TEXT NOT NULL,
  wa_mitra TEXT NOT NULL,
  wilayah TEXT,
  total_referral INTEGER DEFAULT 0,
  total_komisi BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8B. MITRA REKANAN VENDOR / TEKNISI (Service Partners)
-- (Khusus Super Admin - Anti Bypass)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  business_name TEXT,
  specialty TEXT NOT NULL,
  coverage_area TEXT NOT NULL,
  phone TEXT NOT NULL,
  success_fee_percent NUMERIC(5,2) DEFAULT 10.0,
  notes TEXT,
  status TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. TUGAS SURVEI UNTUK SURVEYOR
-- ============================================================
CREATE TABLE IF NOT EXISTS tugas_survei (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('crm_pipeline', 'jasa_survei')),
  source_id UUID NOT NULL,
  surveyor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  kode_aset TEXT,
  lokasi_survei TEXT,
  koordinat_lokasi TEXT,
  instruksi TEXT,
  nama_klien TEXT,
  wa_klien TEXT,
  tanggal_survei DATE,
  jam_survei TEXT,
  foto_laporan JSONB DEFAULT '[]',
  catatan_surveyor TEXT,
  status TEXT DEFAULT 'ditugaskan' CHECK (status IN ('ditugaskan', 'dalam_perjalanan', 'selesai', 'dibatalkan')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEKS UNTUK PERFORMA QUERY
-- ============================================================
CREATE INDEX idx_assets_public_kategori ON assets_public(kategori_utama);
CREATE INDEX idx_assets_public_kabupaten ON assets_public(kabupaten);
CREATE INDEX idx_assets_public_status ON assets_public(status);
CREATE INDEX idx_assets_public_published ON assets_public(is_published);
CREATE INDEX idx_crm_pipeline_stage ON crm_pipeline(stage);
CREATE INDEX idx_crm_pipeline_status_bayar ON crm_pipeline(status_bayar);
CREATE INDEX idx_tugas_survei_surveyor ON tugas_survei(surveyor_id);
CREATE INDEX idx_affiliate_kode ON affiliate_partners(kode_mitra);

-- ============================================================
-- RPC FUNCTION: View Counter Aset Global
-- ============================================================
CREATE OR REPLACE FUNCTION increment_asset_view(target_kode TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE assets_public
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE kode_aset = target_kode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_public_updated 
  BEFORE UPDATE ON assets_public FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assets_private_vault_updated 
  BEFORE UPDATE ON assets_private_vault FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_crm_pipeline_updated 
  BEFORE UPDATE ON crm_pipeline FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_jasa_survei_updated 
  BEFORE UPDATE ON jasa_survei_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tugas_survei_updated 
  BEFORE UPDATE ON tugas_survei FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_service_partners_updated 
  BEFORE UPDATE ON service_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Aktifkan RLS untuk semua tabel
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets_private_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE jasa_survei_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE titip_aset ENABLE ROW LEVEL SECURITY;
ALTER TABLE sayembara_pencarian ENABLE ROW LEVEL SECURITY;
ALTER TABLE sayembara_laporan ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE tugas_survei ENABLE ROW LEVEL SECURITY;

-- PUBLIK: Bisa baca aset yang sudah dipublish
CREATE POLICY "Publik baca aset published" ON assets_public
  FOR SELECT USING (is_published = true);

-- PUBLIK: Bisa baca sayembara aktif
CREATE POLICY "Publik baca sayembara aktif" ON sayembara_pencarian
  FOR SELECT USING (is_active = true);

-- PUBLIK: Bisa insert laporan sayembara
CREATE POLICY "Publik kirim laporan sayembara" ON sayembara_laporan
  FOR INSERT WITH CHECK (true);

-- PUBLIK: Bisa insert titip aset
CREATE POLICY "Publik kirim titip aset" ON titip_aset
  FOR INSERT WITH CHECK (true);

-- PUBLIK: Bisa insert crm_pipeline (booking survei)
CREATE POLICY "Publik kirim booking survei" ON crm_pipeline
  FOR INSERT WITH CHECK (true);

-- PUBLIK: Bisa insert jasa survei order
CREATE POLICY "Publik kirim order jasa survei" ON jasa_survei_orders
  FOR INSERT WITH CHECK (true);

-- PENGGUNA (Admin / Surveyor): Bisa membaca profilnya sendiri
CREATE POLICY "Pengguna baca profil sendiri" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- SUPER ADMIN: Akses penuh (insert/update/delete) user_profiles
CREATE POLICY "Admin akses penuh user_profiles" ON user_profiles
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh assets_public" ON assets_public
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh brankas" ON assets_private_vault
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh crm" ON crm_pipeline
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh jasa survei" ON jasa_survei_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh titip aset" ON titip_aset
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh sayembara" ON sayembara_pencarian
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh laporan sayembara" ON sayembara_laporan
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh affiliate" ON affiliate_partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh service_partners" ON service_partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Admin akses penuh tugas survei" ON tugas_survei
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- SURVEYOR: Hanya bisa baca tugas survei miliknya sendiri
CREATE POLICY "Surveyor baca tugas sendiri" ON tugas_survei
  FOR SELECT USING (surveyor_id = auth.uid());

-- SURVEYOR: Hanya bisa update tugas survei miliknya (laporan & status)
CREATE POLICY "Surveyor update tugas sendiri" ON tugas_survei
  FOR UPDATE USING (surveyor_id = auth.uid())
  WITH CHECK (surveyor_id = auth.uid());

-- SURVEYOR: Bisa baca profil sendiri
CREATE POLICY "Surveyor baca profil sendiri" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- SURVEYOR: Bisa baca data publik aset (untuk referensi tugas)
CREATE POLICY "Surveyor baca aset publik" ON assets_public
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'surveyor')
  );

-- ============================================================
-- BRANKAS VAULT: DILARANG KERAS untuk surveyor!
-- (Tidak ada policy SELECT/INSERT/UPDATE/DELETE untuk surveyor
--  pada tabel assets_private_vault)
-- ============================================================
