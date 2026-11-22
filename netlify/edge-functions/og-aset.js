// ============================================================
// TABAGSEL HUB - Netlify Edge Function
// Dynamic Open Graph Thumbnail & Metadata for Social Media Bots
// Path: /?aset=KODE_ASET
// ============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://kxtmaticddpbthtcpjpw.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_ILyh8iQ3kRoDSwtZpyuzRA_SlJmzf2r";
const DEFAULT_OG_IMAGE = "https://tabagsel-hub.netlify.app/assets/images/og-cover.jpg";
const SITE_NAME = "TABAGSEL HUB";

// Daftar User-Agent Bot Media Sosial & Chat Apps
const BOT_USER_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "telegrambot",
  "twitterbot",
  "twitter",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "applebot",
  "bingbot",
  "googlebot",
  "skypeuripreview",
  "pinterest",
  "vkshare",
  "w3c_validator",
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

function formatRupiah(num) {
  if (!num && num !== 0) return "Rp 0";
  return "Rp " + Number(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceMeta(html, property, content) {
  const propRegex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["'][^"']*["']\\s*\\/?>`, "i");
  const nameRegex = new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["'][^"']*["']\\s*\\/?>`, "i");

  if (propRegex.test(html)) {
    return html.replace(propRegex, `<meta property="${property}" content="${escapeHtml(content)}">`);
  } else if (nameRegex.test(html)) {
    return html.replace(nameRegex, `<meta name="${property}" content="${escapeHtml(content)}">`);
  } else {
    return html.replace("</head>", `  <meta property="${property}" content="${escapeHtml(content)}">\n</head>`);
  }
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";
  const asetParam = (url.searchParams.get("aset") || url.searchParams.get("id") || "").trim();

  // Jika bukan crawler bot sosial media atau tidak ada parameter aset,
  // teruskan request secara normal ke browser pengguna
  if (!isBot(userAgent) || !asetParam) {
    return context.next();
  }

  try {
    // 1. Ambil data aset dari Supabase REST API
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asetParam);
    let queryFilter = `kode_aset=ilike.${encodeURIComponent(asetParam)}`;
    if (isUuid) {
      queryFilter = `or=(kode_aset.ilike.${encodeURIComponent(asetParam)},id.eq.${encodeURIComponent(asetParam)})`;
    }

    const apiUrl = `${SUPABASE_URL}/rest/v1/assets_public?${queryFilter}&select=*&limit=1`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000), // Timeout 4 detik
    });

    let asset = null;
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        asset = data[0];
      }
    }

    // 2. Jika aset tidak ditemukan, teruskan HTML default
    if (!asset) {
      return context.next();
    }

    // 3. Bangun metadata dinamis per unit aset
    const hargaFormatted = `${formatRupiah(asset.harga_tayang)} (${asset.satuan_harga || "Total"})`;
    const ogTitle = `${asset.judul} - ${hargaFormatted} | ${SITE_NAME}`;

    const katIcon = asset.kategori_utama === "PROPERTI"
      ? "🏠 Properti"
      : asset.kategori_utama === "OTOMOTIF"
      ? "🚗 Otomotif"
      : "🛠️ Jasa";

    const lokasiParts = [asset.kecamatan, asset.kabupaten].filter(Boolean);
    const lokasiText = lokasiParts.length > 0 ? lokasiParts.join(", ") : "Wilayah Tabagsel";

    let ogDesc = `${katIcon} di ${lokasiText}. Harga: ${hargaFormatted}.`;
    if (asset.deskripsi && asset.deskripsi.trim()) {
      const ringkas = asset.deskripsi.trim().replace(/\s+/g, " ");
      const cuplikan = ringkas.length > 100 ? ringkas.substring(0, 97) + "..." : ringkas;
      ogDesc += ` ${cuplikan}`;
    }
    ogDesc += " Bebas calo liar & transaksi resmi aman terverifikasi Tabagsel Hub.";

    // Thumbnail: Gunakan foto_utama aset, optimalkan untuk WhatsApp/FB jika di Cloudinary
    let ogImage = asset.foto_utama || DEFAULT_OG_IMAGE;
    if (ogImage.includes("cloudinary.com") && ogImage.includes("/upload/")) {
      // Pastikan format JPEG dan ukuran rasio 1200x630 untuk WhatsApp / Facebook scraper
      if (!ogImage.includes("/upload/c_fill")) {
        ogImage = ogImage.replace("/upload/", "/upload/c_fill,w_1200,h_630,f_jpg,q_auto/");
      }
    }

    const ogUrl = `https://tabagsel-hub.netlify.app/?aset=${encodeURIComponent(asset.kode_aset || asetParam)}`;

    // 4. Ambil HTML asli dan injeksikan meta tag Open Graph dinamis
    const response = await context.next();
    let html = await response.text();

    html = replaceMeta(html, "og:title", ogTitle);
    html = replaceMeta(html, "og:description", ogDesc);
    html = replaceMeta(html, "og:url", ogUrl);
    html = replaceMeta(html, "og:image", ogImage);
    html = replaceMeta(html, "og:image:secure_url", ogImage);
    html = replaceMeta(html, "og:image:type", "image/jpeg");
    html = replaceMeta(html, "og:image:width", "1200");
    html = replaceMeta(html, "og:image:height", "630");

    html = replaceMeta(html, "twitter:card", "summary_large_image");
    html = replaceMeta(html, "twitter:title", ogTitle);
    html = replaceMeta(html, "twitter:description", ogDesc);
    html = replaceMeta(html, "twitter:image", ogImage);

    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(ogTitle)}</title>`);
    html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta name="description" content="${escapeHtml(ogDesc)}">`);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "public, max-age=0, must-revalidate",
        "x-og-processed-for": asset.kode_aset || asetParam,
      },
    });
  } catch (err) {
    console.error("[OG Edge Function Error]", err);
    // Jika ada error jaringan atau parsing, fallback aman ke halaman default
    return context.next();
  }
}
