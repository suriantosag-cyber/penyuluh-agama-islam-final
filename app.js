const KEY="surianto2026_data_v2";
const SESSION="surianto2026_admin";
const ADMIN_HASH="854ff5df97af3a115c34630d019e2b93bb07aeef0dee5d894782bdfacd49ca8a";
const DB_NAME="penyuluh2026_files";
const DB_STORE="pdfs";

let sb=null;
let cloudMode=false;
function initSupabase(){
  cloudMode=false; sb=null;
  try{
    const cfg=window.SUPABASE_CONFIG||{};
    if(!cfg.url||!cfg.anonKey||cfg.anonKey.includes("PASTE_YOUR")) return;
    if(!window.supabase?.createClient) return;
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    cloudMode=true;
  }catch(e){console.warn("Supabase init gagal",e)}
}
async function loadCloud(){
  if(!cloudMode) return false;
  try{
    const {data:row,error}=await sb.from("site_settings").select("value").eq("key","portal_data").maybeSingle();
    if(error) throw error;
    if(row?.value) data=mergeData(row.value);
    return true;
  }catch(e){ console.warn("Supabase load gagal",e); return false; }
}
async function loadCatinCloud(){
  if(!cloudMode || !sb) return false;
  try{
    const {data:rows,error}=await sb.from("catin_submissions").select("*").order("created_at",{ascending:false});
    if(error) throw error;
    data.catinSubmissions=(rows||[]).map(x=>({id:x.id,createdAt:x.created_at,status:x.status||"Baru",suami:x.suami,nikSuami:x.nik_suami,istri:x.istri,nikIstri:x.nik_istri,ttlSuami:x.ttl_suami,ttlIstri:x.ttl_istri,alamat:x.alamat,whatsapp:x.whatsapp,tanggal:x.tanggal,kua:x.kua,catatan:x.catatan}));
    return true;
  }catch(e){console.warn("Catin cloud load gagal",e);return false;}
}
function mergeData(x){const d=structuredClone(defaultData); return {...d,...x,profile:{...d.profile,...(x.profile||{})}}}
async function saveCloud(){
  if(!cloudMode) return true;
  const payload=structuredClone(data);
  delete payload.catinSubmissions;
  // Galeri cloud dikelola oleh tabel content_items + Storage, jangan disimpan
  // lagi di portal_data agar foto yang sudah dihapus tidak muncul kembali.
  delete payload.gallery;
  const {error}=await sb.from("site_settings").upsert({key:"portal_data",value:payload,updated_at:new Date().toISOString()});
  if(error){console.error(error);toast("Gagal menyimpan ke Supabase: "+error.message);return false;}
  return true;
}
async function uploadMediaRecord(file,folder="upload"){
  if(!cloudMode) return null;
  if(!sb) throw new Error("Supabase belum terhubung");
  const ext=(file.name.split(".").pop()||"bin").toLowerCase();
  const safeFolder=(folder||"upload").replace(/^\/+|\/+$/g,"")||"upload";
  const filename=`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buckets=["website-files","media"];
  let lastError=null;
  for(const bucket of buckets){
    const path=`${safeFolder}/${filename}`;
    try{
      const result=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
      if(!result.error){
        const {data}=sb.storage.from(bucket).getPublicUrl(path);
        return {publicUrl:data.publicUrl,path,bucket};
      }
      lastError=result.error;
      const msg=String(result.error.message||"").toLowerCase();
      if(!msg.includes("bucket") && !msg.includes("not found")) break;
    }catch(e){
      lastError=e;
      const msg=String(e?.message||"").toLowerCase();
      if(!msg.includes("bucket") && !msg.includes("not found")) break;
    }
  }
  throw lastError||new Error("Bucket Storage tidak ditemukan");
}
async function uploadMedia(file,folder="upload"){
  const rec=await uploadMediaRecord(file,folder);
  return rec?.publicUrl||null;
}
async function loadGalleryCloud(){
  if(!cloudMode || !sb) return false;
  try{
    const {data:rows,error}=await sb.from("content_items")
      .select("id,title,excerpt,content,event_date,file_path,file_name,file_type,file_size,image_url,created_at")
      .eq("type","galeri")
      .order("created_at",{ascending:false});
    if(error) throw error;
    const cloudGallery=(rows||[]).map((r,i)=>{
      let src=r.image_url||"";
      if(!src && r.file_path){
        src=r.public_url || (r.bucket ? sb.storage.from(r.bucket).getPublicUrl(r.file_path).data.publicUrl : sb.storage.from("website-files").getPublicUrl(r.file_path).data.publicUrl);
      }
      return {
        id:r.id,title:r.title||r.file_name||"Dokumentasi",
        date:r.event_date||r.created_at||"",src,kind:"image",
        excerpt:r.excerpt||"",content:r.content||"",filePath:r.file_path||""
      };
    }).filter(x=>x.src);
    // Item galeri dari Supabase adalah sumber kebenaran untuk foto upload.
    // Foto bawaan lokal (ID numerik) tetap ditampilkan sebagai dokumentasi awal.
    const builtIn=(data.gallery||[]).filter(g=>g.kind!=="image" || /^\\d+$/.test(String(g.id)));
    data.gallery=[...cloudGallery,...builtIn];
    return true;
  }catch(e){
    console.warn("Supabase gallery load gagal",e);
    return false;
  }
}
const defaultData={
  profile:{name:"Surianto, S.Ag.",title:"Penyuluh Agama Islam – PPPK",office:"KUA Kec. Panca Lautang",sk:"2567/Kw.21.1/Kp.00.3/02/2025",nip:"Belum diisi",whatsapp:"082132244214",bio:"Penyuluh Agama Islam – PPPK yang berfokus pada pembinaan keagamaan masyarakat, penguatan literasi dakwah, pelayanan keagamaan, dan dokumentasi kegiatan KUA."},
  groups:[
    {id:1,name:"BKMT Nurul Hidayah Wette’e",people:30},{id:2,name:"BKMT Nurul Falah Wette’e",people:20},{id:3,name:"BKMT Baitul Ibadah",people:15},{id:4,name:"TPA Diniyah DDI Bilokka",people:33}
  ],
  agendas:[
    {id:1,date:"12",month:"SEP",title:"Pembinaan Kelompok Binaan",place:"Wette’e",desc:"Penguatan materi akhlak, keluarga sakinah, dan praktik ibadah."},
    {id:2,date:"18",month:"SEP",title:"Kajian Keislaman Masyarakat",place:"KUA Panca Lautang",desc:"Kajian tematik dan sesi tanya jawab bersama peserta."},
    {id:3,date:"27",month:"SEP",title:"Pendampingan TPA Diniyah",place:"Bilokka",desc:"Pembinaan baca Al-Qur’an dan penguatan karakter santri."}
  ],
  materials:[
    {id:1,title:"Menjaga Lisan di Era Digital",tag:"Akhlak",excerpt:"Etika komunikasi, tabayyun, dan tanggung jawab bermedia sosial.",content:"<h2>Menjaga Lisan di Era Digital</h2><p>Perkembangan teknologi membuat komunikasi menjadi sangat cepat. Karena itu, menjaga lisan juga berarti menjaga tulisan, komentar, unggahan, dan pesan yang kita kirim.</p><h3>Prinsip utama</h3><ul><li>Pastikan informasi benar sebelum membagikannya.</li><li>Hindari membuka aib dan merendahkan orang lain.</li><li>Gunakan bahasa yang santun dan membangun.</li></ul><p>Dengan membiasakan tabayyun dan memilih kata yang baik, ruang digital dapat menjadi sarana dakwah yang menyejukkan.</p>"},
    {id:2,title:"Keluarga Sakinah: Memulai dari Komunikasi",tag:"Keluarga",excerpt:"Membangun rumah tangga yang tenang melalui komunikasi, saling menghormati, dan musyawarah.",content:"<h2>Keluarga Sakinah</h2><p>Keluarga yang kuat dibangun melalui komunikasi yang jujur, lembut, dan terbuka. Perbedaan tidak harus menjadi sumber konflik apabila dibicarakan dengan kepala dingin.</p><p>Luangkan waktu untuk bermusyawarah, mendengarkan pasangan, dan mendidik anak dengan keteladanan.</p>"},
    {id:3,title:"Keutamaan Sedekah dan Kepedulian Sosial",tag:"Muamalah",excerpt:"Sedekah sebagai latihan keikhlasan sekaligus penguat kepedulian terhadap sesama.",content:"<h2>Sedekah dan Kepedulian</h2><p>Sedekah bukan hanya tentang nominal. Senyum, bantuan tenaga, ilmu yang bermanfaat, dan kepedulian kepada tetangga juga merupakan bentuk kebaikan.</p><p>Bangun kebiasaan berbagi secara rutin sesuai kemampuan dan jaga keikhlasan.</p>"}
  ],
  news:[
    {id:1,title:"Bimbingan Calon Pengantin Mandiri di KUA Kecamatan Panca Lautang",date:"13 September 2026",category:"Kegiatan",photoUrl:"assets/galeri-bimbingan-catin.jpg",excerpt:"Bimbingan calon pengantin mandiri dilaksanakan di Kantor Urusan Agama Kecamatan Panca Lautang sebagai bagian dari pembinaan menuju kehidupan keluarga yang harmonis.",content:"<p><b>Bimbingan calon pengantin mandiri</b> dilaksanakan di Kantor Urusan Agama Kecamatan Panca Lautang. Kegiatan ini menjadi bagian dari pembinaan bagi calon pengantin sebelum memasuki kehidupan berumah tangga.</p><p>Pembinaan diarahkan pada pemahaman keagamaan, kesiapan kehidupan keluarga, komunikasi, dan tanggung jawab dalam membangun rumah tangga.</p>"},
    {id:2,title:"Pembinaan dan Pertemuan di Ruang KUA Panca Lautang",date:"2 September 2026",category:"Pembinaan",photoUrl:"assets/galeri-pembinaan-kua.jpg",excerpt:"Pertemuan di ruang KUA menjadi bagian dari kegiatan pembinaan dan komunikasi pelayanan keagamaan bersama peserta.",content:"<p>Kegiatan pembinaan dan pertemuan dilaksanakan di ruang Kantor Urusan Agama Kecamatan Panca Lautang. Pertemuan menjadi ruang untuk berdiskusi, menyampaikan informasi, dan memperkuat komunikasi dalam pelayanan keagamaan.</p><p>Dokumentasi ini merupakan bagian dari aktivitas pembinaan yang berlangsung di lingkungan KUA.</p>"},
    {id:3,title:"Pelayanan dan Pembinaan Keagamaan di KUA",date:"2 September 2026",category:"Berita",photoUrl:"assets/galeri-pelayanan-kua.jpg",excerpt:"Suasana pelayanan dan pembinaan di ruang KUA yang melibatkan petugas dan peserta dalam kegiatan administrasi serta pembinaan.",content:"<p>Pelayanan dan pembinaan keagamaan berlangsung di ruang Kantor Urusan Agama Kecamatan Panca Lautang. Kegiatan melibatkan petugas dan peserta dalam suasana pelayanan serta komunikasi yang tertib.</p><p>Dokumentasi ini memperlihatkan salah satu aktivitas pelayanan dan pembinaan yang dilakukan di lingkungan KUA.</p>"}
  ],
  reports:[
    {id:1,title:"Laporan Kegiatan Pembinaan Bulanan",date:"31 Agustus 2026",type:"PDF-ready",summary:"Rekap pelaksanaan pembinaan kelompok binaan, peserta, materi, dan tindak lanjut."},
    {id:2,title:"Laporan Dokumentasi Kegiatan KUA",date:"20 Agustus 2026",type:"PDF-ready",summary:"Ringkasan kegiatan penyuluhan, pelayanan, dan dokumentasi lapangan."}
  ],
  catinSubmissions:[],
  gallery:[
    {id:1,title:"Bimbingan Calon Pengantin Mandiri",date:"13 September 2026",src:"assets/galeri-bimbingan-catin.jpg",kind:"image",featured:true},
    {id:2,title:"Pembinaan di Ruang KUA",date:"2 September 2026",src:"assets/galeri-pembinaan-kua.jpg",kind:"image"},
    {id:3,title:"Pelayanan dan Pembinaan di KUA",date:"2 September 2026",src:"assets/galeri-pelayanan-kua.jpg",kind:"image"}
  ]
};

function load(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(defaultData)}catch(e){return structuredClone(defaultData)}}
let data=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){toast("Penyimpanan browser penuh.")}
  if(cloudMode) saveCloud();
  return true;
}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(msg){const el=document.getElementById("toast");if(!el)return;el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function wa(){return "https://wa.me/62"+String(data.profile.whatsapp||"").replace(/^0/,"")}
function isAdmin(){return sessionStorage.getItem(SESSION)==="1"}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(DB_STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putPdf(blob){const db=await openDB();const id="pdf_"+Date.now()+"_"+Math.random().toString(36).slice(2);return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).put(blob,id);tx.oncomplete=()=>resolve(id);tx.onerror=()=>reject(tx.error)})}
async function getPdf(id){if(!id)return null;const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,"readonly");const r=tx.objectStore(DB_STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}

function publicPage(){
 document.title=`${data.profile.name} | ${data.profile.title}`;
 const newsHtml=data.news.map(n=>`<article class="card news-card"><div class="news-paper-head"><span class="news-mark">${esc((n.category||"Berita").slice(0,1))}</span><span class="tag">${esc(n.category||"Berita")}</span></div>${n.photoUrl?`<button class="news-photo-button" onclick="openNews(${n.id});return false" aria-label="Buka berita ${esc(n.title)}"><img class="news-photo" src="${esc(n.photoUrl)}" alt="${esc(n.title)}"></button>`:``}<div class="news-body"><h3>${esc(n.title)}</h3><p class="news-date">📅 ${esc(n.date)}</p><p>${esc(n.excerpt)}</p><a class="read" href="/berita/${newsSlug(n)}" onclick="openNews(${n.id});return false">Baca selengkapnya →</a></div></article>`).join("");
 const matHtml=data.materials.map(m=>`<article class="card article"><div class="article-body"><span class="tag">${esc(m.tag)}</span><h3>${esc(m.title)}</h3><p>${esc(m.excerpt)}</p><div class="article-actions"><a class="read" href="#baca-${m.id}" onclick="openArticle(${m.id});return false">Baca materi →</a>${m.pdfUrl||m.pdfId?`<button class="pdf-link" onclick="openArticle(${m.id})">📄 Buka Full PDF</button>`:""}</div></div></article>`).join("");
 document.getElementById("app").innerHTML=`
 <div class="topbar"><div class="container"><span>Portal Penyuluh Agama Islam • 2026</span><span>Pelayanan & Pembinaan Keagamaan Masyarakat</span></div></div>
 <nav class="nav"><div class="container nav-inner"><a class="brand" href="#profil"><img class="brand-logo" src="assets/logo-kemenag-kua.png" alt="Logo Kementerian Agama KUA Panca Lautang"><span><b>Surianto, S.Ag.</b><small>Penyuluh Agama Islam – PPPK</small></span></a><button class="menu-btn" onclick="document.querySelector('.navlinks').classList.toggle('open')">☰</button><div class="navlinks"><a href="#profil">Profil</a><a href="#binaan">Binaan</a><a href="#agenda">Agenda</a><a href="#materi">Materi</a><a href="#berita">Berita & Foto</a><a href="#laporan">Laporan</a><a href="#galeri">Galeri</a><a href="#catin">Formulir Catin</a><a href="#dokumen">Dokumen/PDF</a><a href="#ai" onclick="openAntoChat();return false">💬 Sahabat KUA</a></div><div class="nav-actions"><a class="btn btn-primary" href="${wa()}" target="_blank">WhatsApp</a><a class="btn btn-light" href="#admin" onclick="showLogin()">Admin</a></div></div></nav>
 <section class="hero" id="profil"><div class="hero-glow"></div><div class="container hero-grid"><div><div class="kicker"><span class="dot"></span>${esc(data.profile.title)}</div><div class="hero-title-row"><div><h1>${esc(data.profile.name)}<br><span>untuk masyarakat.</span></h1></div><img class="hero-logo" src="assets/logo-kemenag-kua.png" alt="Logo Kementerian Agama KUA Kec. Panca Lautang"></div><p>${esc(data.profile.bio)}</p><div class="hero-meta"><span>🏛️ ${esc(data.profile.office)}</span><span>📜 SK ${esc(data.profile.sk)}</span></div><div class="hero-actions"><a class="btn btn-light" href="#agenda">Lihat agenda</a><a class="btn btn-outline" href="#materi">Baca materi dakwah</a></div></div><div class="profile-card"><div class="profile-frame"><img src="assets/profile.jpg" alt="Foto ${esc(data.profile.name)}"></div><div class="profile-badge"><b>${esc(data.profile.title)}</b><small>${esc(data.profile.office)}</small></div></div></div></section>
 <section class="stats"><div class="container stats-grid"><div class="stat"><b>${data.groups.length}</b><span>Kelompok binaan</span></div><div class="stat"><b>${data.groups.reduce((a,b)=>a+Number(b.people||0),0)}</b><span>Total peserta binaan</span></div><div class="stat"><b>${data.agendas.length}</b><span>Agenda tercatat</span></div><div class="stat"><b>${data.materials.length}</b><span>Materi dakwah</span></div></div></section>
 <section class="section" id="binaan"><div class="container"><div class="section-head"><div><div class="eyebrow">Pembinaan</div><h2>Kelompok binaan</h2><p class="section-lead">Data kelompok dan jumlah peserta yang menjadi bagian dari pembinaan keagamaan.</p></div></div><div class="grid-2">${data.groups.map((g,i)=>`<div class="card group-card"><div class="group-icon">${["◈","✦","☾","▣"][i%4]}</div><h3>${esc(g.name)}</h3><div class="people">${esc(g.people)} <small>orang peserta</small></div><div class="muted-small">Kelompok binaan ${i+1}</div></div>`).join("")}</div></div></section>
 <section class="section alt" id="agenda"><div class="container"><div class="section-head"><div><div class="eyebrow">Kalender</div><h2>Agenda kegiatan</h2><p class="section-lead">Rangkaian kegiatan pembinaan, kajian, dan pendampingan.</p></div></div><div class="grid-3">${data.agendas.map(a=>`<div class="card agenda"><div class="date-box"><b>${esc(a.date)}</b><span>${esc(a.month)}</span></div><div><h3>${esc(a.title)}</h3><p><b>${esc(a.place)}</b></p><p>${esc(a.desc)}</p></div></div>`).join("")}</div></div></section>
 <section class="section" id="materi"><div class="container"><div class="section-head"><div><div class="eyebrow">Dakwah</div><h2>Materi dakwah & PDF</h2><p class="section-lead">Materi dapat dibaca langsung. Jika tersedia PDF, tombol <b>Buka Full PDF</b> akan menampilkan seluruh halaman di dalam website.</p></div></div><div class="grid-3">${matHtml}</div></div></section>
 <section class="section alt" id="berita"><div class="container"><div class="section-head"><div><div class="eyebrow">Informasi terbaru</div><h2>Berita & kegiatan</h2><p class="section-lead">Berita terbaru dari kegiatan penyuluhan, pembinaan kelompok, dan KUA Panca Lautang.</p></div></div><div class="grid-3">${newsHtml}</div></div></section>
 <section class="section" id="laporan"><div class="container"><div class="section-head"><div><div class="eyebrow">Dokumentasi</div><h2>Laporan kegiatan KUA</h2><p class="section-lead">Ringkasan laporan yang dapat dicetak atau disimpan sebagai PDF melalui browser.</p></div></div><div style="display:grid;gap:12px">${data.reports.map(r=>`<div class="card report-card"><div class="report-meta"><div class="file-icon">PDF</div><div><b>${esc(r.title)}</b><div class="muted-small">${esc(r.date)} • ${esc(r.type)}</div></div></div><button class="btn btn-dark" onclick="printReport(${r.id})">Cetak / PDF</button></div>`).join("")}</div></div></section>
 <section class="section" id="galeri"><div class="container"><div class="section-head"><div><div class="eyebrow">Visual</div><h2>Galeri dokumentasi & KUA</h2><p class="section-lead">Dokumentasi kegiatan ditampilkan dengan susunan dinamis. Klik foto untuk melihat ukuran besar dan berpindah ke foto berikutnya.</p></div></div><div class="gallery gallery-masonry">${data.gallery.map((g,i)=>`<button class="gallery-item ${g.featured?'gallery-featured':''}" onclick="openGallery(${i})" aria-label="Buka ${esc(g.title)}">${g.src?`<img src="${g.src}" alt="${esc(g.title)}">`:`<div class="gallery-placeholder">✦</div>`}<span class="gallery-overlay"><strong>${esc(g.title)}</strong>${g.date?`<small>📅 ${esc(g.date)}</small>`:""}</span></button>`).join("")}</div></div></section>
 <section class="section alt catin-section" id="catin"><div class="container"><div class="section-head"><div><div class="eyebrow">Layanan Catin</div><h2>Formulir Catin Online</h2><p class="section-lead">Isi data calon pengantin untuk pengajuan informasi awal dan pembinaan. Setelah dikirim, data tercatat di perangkat admin yang digunakan.</p></div></div><div class="catin-layout"><div class="card catin-card"><div class="catin-badge">💍 CALON PENGANTIN</div><h3>Data Calon Pengantin</h3><form id="catinForm" onsubmit="submitCatin(event)"><div class="form-grid"><div class="field"><label>Nama calon suami *</label><input id="catin_suami" required placeholder="Nama lengkap"></div><div class="field"><label>NIK calon suami *</label><input id="catin_nik_suami" required inputmode="numeric" maxlength="16" placeholder="16 digit NIK"></div><div class="field"><label>Nama calon istri *</label><input id="catin_istri" required placeholder="Nama lengkap"></div><div class="field"><label>NIK calon istri *</label><input id="catin_nik_istri" required inputmode="numeric" maxlength="16" placeholder="16 digit NIK"></div><div class="field"><label>Tempat/tanggal lahir calon suami</label><input id="catin_ttl_suami" placeholder="Contoh: Sidrap, 10 Januari 1995"></div><div class="field"><label>Tempat/tanggal lahir calon istri</label><input id="catin_ttl_istri" placeholder="Contoh: Sidrap, 12 Mei 1997"></div><div class="field full"><label>Alamat tempat tinggal *</label><textarea id="catin_alamat" rows="3" required placeholder="Alamat lengkap"></textarea></div><div class="field"><label>Nomor WhatsApp *</label><input id="catin_wa" required inputmode="tel" placeholder="08xxxxxxxxxx"></div><div class="field"><label>Rencana tanggal pernikahan</label><input id="catin_tanggal" type="date"></div><div class="field full"><label>KUA tujuan</label><input id="catin_kua" value="${esc(data.profile.office)}"></div><div class="field full"><label>Catatan / kebutuhan layanan</label><textarea id="catin_catatan" rows="3" placeholder="Tulis pertanyaan atau kebutuhan Anda"></textarea></div></div><label class="catin-consent"><input id="catin_consent" type="checkbox" required> <span>Saya menyatakan data yang saya kirim benar dan bersedia dihubungi untuk keperluan layanan KUA.</span></label><button class="btn btn-primary" type="submit">📨 Kirim Formulir Catin</button></form></div><div class="card catin-info"><div class="catin-info-icon">✓</div><h3>Setelah formulir dikirim</h3><ol><li>Data tersimpan pada sistem website sesuai mode penyimpanan yang digunakan.</li><li>Admin dapat memeriksa data masuk melalui Dashboard Admin.</li><li>Untuk persyaratan resmi dan ketentuan terbaru, calon pengantin tetap perlu melakukan konfirmasi kepada KUA.</li></ol><a class="btn btn-outline" href="${wa()}" target="_blank" rel="noopener">Hubungi Penyuluh via WhatsApp</a></div></div></div></section>
 <section class="section" id="dokumen"><div class="container"><div class="section-head"><div><div class="eyebrow">Dokumen</div><h2>Dokumen / PDF</h2><p class="section-lead">Dokumen PDF yang tersedia dapat dibaca langsung dari website.</p></div></div><div class="grid-2">${data.materials.filter(m=>m.pdfUrl).map(m=>`<div class="card"><h3>${esc(m.title)}</h3><p>${esc(m.excerpt||"")}</p><a class="btn btn-primary" href="${esc(m.pdfUrl)}" target="_blank" rel="noopener">📄 Buka PDF</a></div>`).join("")||`<div class="card"><p>Belum ada dokumen PDF.</p></div>`}</div></div></section>
<section class="section alt" id="ai"><div class="container"><div class="section-head"><div><div class="eyebrow">Layanan digital</div><h2>💬 Sahabat KUA</h2><p class="section-lead">Punya pertanyaan seputar layanan KUA? Silakan ngobrol langsung dengan Sahabat KUA.</p></div></div><div class="anto-preview-card"><div class="anto-preview-head"><img src="assets/profile.jpg" alt="Sahabat KUA"><div><strong>Sahabat KUA</strong><span>Petugas KUA · Siap Membantu</span></div><button class="anto-open-btn" onclick="openAntoChat()">💬 Mulai Chat</button></div><div class="anto-preview-body"><div class="anto-bubble"><strong>Assalamu’alaikum, saya Sahabat KUA.</strong><br>Ada yang bisa saya bantu?<small>Silakan tanyakan layanan KUA, administrasi, penyuluhan agama, pernikahan, wali & saksi, buku nikah, rujuk, isbat nikah, dan lainnya.</small></div></div></div></div></section><div id="antoFab" class="anto-fab-wrap"><button class="anto-fab" onclick="openAntoChat()" aria-label="Buka Sahabat KUA"><span class="anto-fab-text"><strong>Sahabat KUA</strong><small>Klik untuk chat</small></span><span class="anto-fab-photo"><img src="assets/profile.jpg" alt="Sahabat KUA"><i></i></span></button></div><div id="antoChat" class="anto-chat" aria-hidden="true"><div class="anto-chat-head"><img src="assets/profile.jpg" alt="Sahabat KUA"><div><strong>Sahabat KUA</strong><span>Petugas KUA · Siap Membantu</span></div><button onclick="minimizeAntoChat()" aria-label="Minimalkan">−</button><button onclick="closeAntoChat()" aria-label="Tutup">×</button></div><div class="anto-chat-body" id="antoChatBody"><div class="anto-msg-row"><img src="assets/profile.jpg" alt="Sahabat KUA"><div><div class="anto-msg anto-msg-in">Assalamu’alaikum, saya Sahabat KUA. 👋<br>Ada yang bisa saya bantu?<small>Silakan ajukan pertanyaan seputar layanan KUA, administrasi, penyuluhan agama, pernikahan, wali & saksi, buku nikah, rujuk, isbat nikah, atau informasi lainnya.</small></div><time>Baru saja</time></div></div></div><div class="anto-topics">${["Pernikahan","Persyaratan nikah","Wali & saksi","Buku nikah","Rujuk","Isbat nikah","Keluarga sakinah","Layanan KUA lainnya"].map(t=>`<button onclick="askAnto('${t.replace(/'/g,"\\'")}')">${t}</button>`).join("")}</div><div class="anto-chat-form"><span>📎</span><input id="antoQuestion" placeholder="Tulis pesan Anda..." onkeydown="if(event.key==='Enter')askAnto()"><button onclick="askAnto()" aria-label="Kirim">➤</button></div><div class="anto-status"><i></i>Sahabat KUA siap membantu Anda</div></div>
<section class="section"><div class="container"><div class="cta"><div><h2>Terhubung dengan Penyuluh</h2><p>Untuk informasi kegiatan, pembinaan, dan komunikasi melalui WhatsApp.</p></div><a class="btn btn-light" href="${wa()}" target="_blank">Chat WhatsApp →</a></div></div></section>
 <footer class="footer"><div class="container footer-grid"><div><img class="footer-logo" src="assets/logo-kemenag-kua.png" alt="Logo"><h3>${esc(data.profile.name)}</h3><p>${esc(data.profile.title)}<br>${esc(data.profile.office)}</p></div><div><h4>Informasi</h4><p>SK: ${esc(data.profile.sk)}<br>NIP: ${esc(data.profile.nip)}</p></div><div><h4>Kontak</h4><p>WhatsApp: ${esc(data.profile.whatsapp)}<br><a href="#admin" onclick="showLogin()">Login Admin →</a></p></div></div><div class="container copyright"><span>© 2026 ${esc(data.profile.name)} • Portal Penyuluh Agama Islam</span><span>Logo Kemenag/KUA • Full PDF Reader • Berita Online</span></div></footer>
 <a class="wa" href="${wa()}" target="_blank" aria-label="WhatsApp">◉</a>
 <div class="modal-backdrop" id="articleModal"><div class="modal modal-xl"><div class="modal-head"><h3 id="articleTitle"></h3><button class="btn btn-light" onclick="closeModal('articleModal')">Tutup</button></div><div id="articleContent"></div></div></div>
 <div class="modal-backdrop" id="newsModal"><div class="modal modal-xl news-modal-reader"><div class="modal-head"><h3 id="newsTitle"></h3><button class="btn btn-light" onclick="closeNews()">Tutup</button></div><div id="newsContent"></div></div></div>
 <div class="modal-backdrop" id="galleryModal"><div class="modal modal-gallery"><div class="modal-head"><div><h3 id="galleryTitle"></h3><div id="galleryDate" class="muted-small"></div></div><button class="btn btn-light" onclick="closeModal('galleryModal')">Tutup</button></div><div id="galleryContent"></div><div class="gallery-nav"><button class="btn btn-light" onclick="galleryPrev()">← Sebelumnya</button><span id="galleryCounter" class="muted-small"></span><button class="btn btn-light" onclick="galleryNext()">Berikutnya →</button></div></div></div>
 <div class="modal-backdrop" id="loginModal"><div class="modal" style="width:min(430px,100%)"><div class="modal-head"><h3>Login Admin</h3><button class="btn btn-light" onclick="closeModal('loginModal')">Tutup</button></div>${cloudMode?`<div class="field"><label>Email Admin</label><input id="loginEmail" type="email" placeholder="email admin Supabase"></div>`:``}<div class="field"><label>Password</label><input id="loginPass" type="password" placeholder="Masukkan password admin" onkeydown="if(event.key==='Enter')doLogin()"></div><button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="doLogin()">Masuk ke Dashboard</button><div class="login-note">${cloudMode?"Login memakai Supabase Auth.":"Mode lokal sementara — hubungkan Supabase untuk keamanan produksi."}</div></div></div>`;
}
function showLogin(){setTimeout(()=>document.getElementById("loginModal")?.classList.add("show"),20)}
function closeModal(id){document.getElementById(id)?.classList.remove("show")}
async function openArticle(id){const m=data.materials.find(x=>x.id==id);if(!m)return;const box=document.getElementById("articleContent");document.getElementById("articleTitle").textContent=m.title;box.innerHTML=`<div class="article-reading">${m.content||"<p>Belum ada isi materi.</p>"}</div>`;if(m.pdfUrl||m.pdfId){box.innerHTML+=`<div class="pdf-heading"><span>📄 Dokumen PDF Lengkap</span>${m.pdfUrl?`<a class="btn btn-primary" href="${esc(m.pdfUrl)}" target="_blank">Buka di Tab Baru</a>`:""}</div><div id="pdfViewer" class="pdf-viewer"><div class="pdf-loading">Memuat PDF…</div></div>`}document.getElementById("articleModal").classList.add("show");if(m.pdfUrl){document.getElementById("pdfViewer").innerHTML=`<iframe src="${esc(m.pdfUrl)}#toolbar=1&navpanes=0&view=FitH" title="PDF ${esc(m.title)}"></iframe>`}else if(m.pdfId){try{const blob=await getPdf(m.pdfId);if(blob){const url=URL.createObjectURL(blob);document.getElementById("pdfViewer").innerHTML=`<iframe src="${url}#toolbar=1&navpanes=0&view=FitH" title="PDF ${esc(m.title)}"></iframe><div class="pdf-actions"><a class="btn btn-primary" href="${url}" target="_blank">Buka PDF Penuh</a><a class="btn btn-light" href="${url}" download="${esc(m.title)}.pdf">Download PDF</a></div>`}else document.getElementById("pdfViewer").innerHTML=`<div class="pdf-loading">File PDF tidak ditemukan pada browser ini.</div>`}catch(e){document.getElementById("pdfViewer").innerHTML=`<div class="pdf-loading">PDF gagal dimuat.</div>`}}
}
function newsSlug(n){
  return String(n?.title||"berita").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")
    .slice(0,90) || ("berita-"+n.id);
}
function newsUrl(n){
  return location.origin + "/berita/" + newsSlug(n);
}
function updateNewsMeta(n){
  try{
    if(!n) return;
    const title=n.title||n.judul||"Berita KUA";
    const desc=(n.summary||n.excerpt||n.description||n.content||n.isi||"Informasi berita KUA").toString().replace(/\\s+/g," ").slice(0,180);
    const img=n.image_url||n.image||n.photo||n.file_url||"";
    const set=(sel,val)=>{
      let el=document.querySelector(sel);
      if(!el){ el=document.createElement("meta"); if(sel.includes("og:")) el.setAttribute("property",sel.slice(1,-1)); else el.setAttribute("name",sel.slice(1,-1)); document.head.appendChild(el); }
      el.setAttribute("content",val||"");
    };
    set('[og:title]',title);
    set('[og:description]',desc);
    set('[og:url]',location.href);
    if(img) set('[og:image]',img);
    set('[twitter:title]',title);
    set('[twitter:description]',desc);
    if(img) set('[twitter:image]',img);
    document.title=title+" — Penyuluh Agama Islam";
  }catch(e){console.warn("Meta update gagal",e)}
}
function newsFromPath(){
  try{
    const path=(location.pathname||"/").replace(/\/+$/,"")||"/";
    const m=path.match(/^\/berita\/([^/]+)$/i);
    if(!m) return null;
    const slug=decodeURIComponent(m[1]);
    const list=Array.isArray(data?.news)?data.news:[];
    return list.find(n=>newsSlug(n)===slug) || list.find(n=>String(n.id)===slug) || null;
  }catch(e){ return null; }
}
function openNewsPath(n, replace=false){
  const url="/berita/"+newsSlug(n);
  history[replace?"replaceState":"pushState"]({newsId:n.id},"",url);
}
function closeNews(){
  document.getElementById("newsModal")?.classList.remove("show");
  if(location.pathname.startsWith("/berita/")) history.pushState({},"","/");
}
function openNews(id, fromRoute=false){
 const n=data.news.find(x=>x.id==id); if(!n)return;
 const related=data.news.filter(x=>x.id!==n.id).slice(0,4);
 const safeUrl=newsUrl(n);
 const relatedHtml=related.map(r=>`
   <article class="newspaper-related-card">
     <button class="newspaper-related-image" onclick="openNews(${r.id})" aria-label="Buka berita ${esc(r.title)}">
       ${r.photoUrl?`<img src="${esc(r.photoUrl)}" alt="${esc(r.title)}">`:`<span>📰</span>`}
     </button>
     <div class="newspaper-related-text">
       <h3><button onclick="openNews(${r.id})">${esc(r.title)}</button></h3>
       <div>📅 ${esc(r.date||"")}</div>
     </div>
   </article>`).join("");
 document.getElementById("newsTitle").textContent="Berita";
 document.getElementById("newsContent").innerHTML=`
 <article class="newspaper-article">
   <div class="newspaper-kicker">${esc(n.category||"Berita KUA")}</div>
   <h1 class="newspaper-title">${esc(n.title||"Berita")}</h1>
   <div class="newspaper-byline">
     <span>📅 ${esc(n.date||"")}</span>
     <span>✍️ Penyuluh Agama Islam</span>
     <span>📍 KUA Kecamatan Panca Lautang</span>
   </div>

   ${n.photoUrl?`
   <figure class="newspaper-hero">
     <img src="${esc(n.photoUrl)}" alt="${esc(n.title||"Berita")}">
     <figcaption>Dokumentasi kegiatan • ${esc(n.date||"")}</figcaption>
   </figure>`:""}

   <div class="newspaper-layout">
     <div class="newspaper-main">
       ${n.excerpt?`<p class="newspaper-lead">${esc(n.excerpt)}</p>`:""}
       <div class="news-full newspaper-body">
         ${n.content||`<p>${esc(n.excerpt||"Belum ada isi berita.")}</p>`}
       </div>

       <div class="newspaper-share">
         <strong>Bagikan Berita:</strong>
         <button class="share-btn share-wa" onclick="shareToWhatsApp(${n.id})">☘ WhatsApp</button>
         <button class="share-btn share-fb" onclick="shareToFacebook(${n.id})">f Facebook</button>
         <button class="share-btn share-x" onclick="shareToX(${n.id})">𝕏 X (Twitter)</button>
         <button class="share-btn share-copy" onclick="copyNewsLink(${n.id})">🔗 Salin Link</button>
       </div>
     </div>

     <aside class="newspaper-sidebar">
       <div class="newspaper-sidebar-box newspaper-info-box">
         <b>📰 Berita KUA</b>
         <span>${esc(n.category||"Berita")}</span>
         <span>📅 ${esc(n.date||"")}</span>
         <span>📍 KUA Kec. Panca Lautang</span>
       </div>
       ${related.length?`
       <div class="newspaper-sidebar-box">
         <b>Berita Lainnya</b>
         ${related.map(r=>`
           <button class="related-news-mini" onclick="openNews(${r.id})">
             ${r.photoUrl?`<img src="${esc(r.photoUrl)}" alt="">`:`<span class="related-mini-placeholder">📰</span>`}
             <span><strong>${esc(r.title)}</strong><small>📅 ${esc(r.date||"")}</small></span>
           </button>`).join("")}
       </div>`:""}
     </aside>
   </div>

   ${related.length?`
   <section class="newspaper-related-section">
     <div class="newspaper-section-heading"><span>📰</span><h2>Berita Lainnya</h2></div>
     <div class="newspaper-related-grid">${relatedHtml}</div>
   </section>`:""}
 </article>`;
 document.getElementById("newsModal").classList.add("show");
 document.title=`${n.title} | Penyuluh Agama Islam`;
 updateNewsMeta(n);
 if(!fromRoute) openNewsPath(n);
}
async function shareToWhatsApp(id){
 const n=data.news.find(x=>x.id==id); if(!n)return;
 const text=`${n.title}\n${newsUrl(n)}`;
 window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
}
function shareToFacebook(id){
 const n=data.news.find(x=>x.id==id); if(!n)return;
 window.open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(newsUrl(n)),"_blank","noopener,noreferrer,width=700,height=600");
}
function shareToX(id){
 const n=data.news.find(x=>x.id==id); if(!n)return;
 const text=(n.title||"Berita KUA")+" — Penyuluh Agama Islam";
 window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(text)+"&url="+encodeURIComponent(newsUrl(n)),"_blank","noopener,noreferrer,width=700,height=600");
}
async function shareNews(id){
 const n=data.news.find(x=>x.id==id); if(!n)return;
 const url=newsUrl(n);
 if(navigator.share){
   try{await navigator.share({title:n.title,text:n.excerpt||"Berita Penyuluh Agama Islam",url});return}catch(e){}
 }
 await copyText(url); toast("Link berita berhasil disalin.");
}
async function copyNewsLink(id){
 const n=data.news.find(x=>x.id==id); if(!n)return; const url=newsUrl(n);
 await copyText(url); toast("Link berita berhasil disalin.");
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text)}catch(e){
   const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
 }
}
let galleryIndex=0;
function renderGalleryModal(){const items=data.gallery.filter(g=>g.src);if(!items.length)return;galleryIndex=Math.max(0,Math.min(galleryIndex,items.length-1));const g=items[galleryIndex];document.getElementById("galleryTitle").textContent=g.title||"Dokumentasi";document.getElementById("galleryDate").textContent=g.date||"";document.getElementById("galleryContent").innerHTML=g.src?`<img class="gallery-lightbox-img" src="${esc(g.src)}" alt="${esc(g.title||"")}">`:`<div class="gallery-placeholder large">✦</div>`;document.getElementById("galleryCounter").textContent=`${galleryIndex+1} / ${items.length}`;}
function openGallery(index){const items=data.gallery.filter(g=>g.src);if(!items.length)return;galleryIndex=Math.max(0,Math.min(Number(index)||0,items.length-1));renderGalleryModal();document.getElementById("galleryModal").classList.add("show")}
function galleryPrev(){const items=data.gallery.filter(g=>g.src);if(!items.length)return;galleryIndex=(galleryIndex-1+items.length)%items.length;renderGalleryModal()}
function galleryNext(){const items=data.gallery.filter(g=>g.src);if(!items.length)return;galleryIndex=(galleryIndex+1)%items.length;renderGalleryModal()}
function printReport(id){const r=data.reports.find(x=>x.id==id);const w=window.open("","_blank");w.document.write(`<html><head><title>${esc(r.title)}</title><style>body{font-family:Arial;padding:40px;color:#111;max-width:800px;margin:auto}h1{font-size:28px}hr{border:0;border-top:1px solid #ddd;margin:25px 0}.meta{color:#666}</style></head><body><h1>${esc(r.title)}</h1><div class="meta">${esc(r.date)}</div><hr><p><b>Petugas:</b> ${esc(data.profile.name)}</p><p><b>Unit:</b> ${esc(data.profile.office)}</p><p>${esc(r.summary)}</p><p style="margin-top:70px">Dokumen ini dicetak/dibuat melalui Portal Penyuluh Agama Islam 2026.</p><script>window.print()<\/script></body></html>`);w.document.close()}
async function sha256(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function doLogin(){const p=document.getElementById("loginPass").value;if(cloudMode){const email=document.getElementById("loginEmail")?.value.trim();if(!email||!p)return toast("Isi email dan password admin.");const {error}=await sb.auth.signInWithPassword({email,password:p});if(error)return toast("Login gagal: "+error.message);sessionStorage.setItem(SESSION,"1");closeModal("loginModal");await loadCatinCloud();adminPage();return}if(await sha256(p)===ADMIN_HASH){sessionStorage.setItem(SESSION,"1");closeModal("loginModal");adminPage()}else toast("Password admin salah.")}
async function logout(){if(cloudMode) await sb.auth.signOut();sessionStorage.removeItem(SESSION);location.hash="";publicPage()}

function adminPage(){document.getElementById("app").innerHTML=`<div class="admin-shell"><div class="admin-top"><div class="container admin-top-inner"><div><b>Dashboard Admin</b><span class="admin-sub">Portal Penyuluh 2026</span></div><div><button class="btn btn-light" onclick="publicPage()">Lihat Website</button> <button class="btn btn-primary" onclick="logout()">Keluar</button></div></div></div><div class="admin-layout"><aside class="sidebar"><button class="side-btn active" onclick="adminSection('dashboard',this)">▦ Dashboard</button><button class="side-btn" onclick="adminSection('profile',this)">◯ Profil</button><button class="side-btn" onclick="adminSection('agendas',this)">◷ Agenda</button><button class="side-btn" onclick="adminSection('materials',this)">📄 Materi & PDF</button><button class="side-btn" onclick="adminSection('news',this)">📰 Berita</button><button class="side-btn" onclick="adminSection('reports',this)">▤ Laporan</button><button class="side-btn" onclick="adminSection('gallery',this)">▧ Galeri</button><button class="side-btn" onclick="adminSection('groups',this)">♢ Kelompok Binaan</button><button class="side-btn" onclick="adminSection('catin',this)">💍 Formulir Catin</button></aside><main class="admin-main" id="adminMain"></main></div></div><div class="modal-backdrop" id="adminModal"><div class="modal modal-xl" id="adminModalBody"></div></div>`;adminSection("dashboard",document.querySelector(".side-btn"))}
function adminSection(sec,btn){document.querySelectorAll(".side-btn").forEach(x=>x.classList.remove("active"));if(btn)btn.classList.add("active");const main=document.getElementById("adminMain");if(sec==="dashboard")main.innerHTML=`<h1 class="admin-title">Dashboard</h1><p class="section-lead">Kelola seluruh isi website dari satu tempat.</p><div class="admin-cards"><div class="admin-card"><span>Kelompok binaan</span><b>${data.groups.length}</b></div><div class="admin-card"><span>Peserta binaan</span><b>${data.groups.reduce((a,b)=>a+Number(b.people||0),0)}</b></div><div class="admin-card"><span>Agenda</span><b>${data.agendas.length}</b></div><div class="admin-card"><span>Materi</span><b>${data.materials.length}</b></div><div class="admin-card"><span>Berita</span><b>${data.news.length}</b></div><div class="admin-card"><span>Formulir Catin</span><b>${(data.catinSubmissions||[]).length}</b></div></div><div class="card"><h3>Fitur materi PDF</h3><p class="section-lead">PDF dapat diunggah dari admin dan dibaca full di dalam website. Untuk file besar atau agar bisa diakses lintas perangkat, tempel URL PDF dari Vercel Blob/Supabase pada kolom URL PDF.</p></div>`;else if(sec==="profile")renderProfile(main);else if(sec==="groups")renderGroups(main);else if(sec==="agendas")renderCrud(main,"agendas","Agenda",["title","date","month","place","desc"]);else if(sec==="materials")renderMaterials(main);else if(sec==="news")renderNews(main);else if(sec==="reports")renderCrud(main,"reports","Laporan",["title","date","type","summary"]);else if(sec==="gallery")renderGallery(main);else if(sec==="catin")renderCatinAdmin(main)}
function renderProfile(main){main.innerHTML=`<h1 class="admin-title">Kelola Profil</h1><div class="card"><div class="form-grid"><div class="field"><label>Nama</label><input id="p_name" value="${esc(data.profile.name)}"></div><div class="field"><label>Status/Jabatan</label><input id="p_title" value="${esc(data.profile.title)}"></div><div class="field"><label>KUA</label><input id="p_office" value="${esc(data.profile.office)}"></div><div class="field"><label>Nomor SK</label><input id="p_sk" value="${esc(data.profile.sk)}"></div><div class="field"><label>NIP</label><input id="p_nip" value="${esc(data.profile.nip)}"></div><div class="field"><label>WhatsApp</label><input id="p_wa" value="${esc(data.profile.whatsapp)}"></div><div class="field full"><label>Bio</label><textarea id="p_bio" rows="5">${esc(data.profile.bio)}</textarea></div></div><button class="btn btn-primary" style="margin-top:16px" onclick="saveProfile()">Simpan profil</button></div>`}
function saveProfile(){Object.assign(data.profile,{name:v("p_name"),title:v("p_title"),office:v("p_office"),sk:v("p_sk"),nip:v("p_nip"),whatsapp:v("p_wa"),bio:v("p_bio")});save();toast("Profil disimpan");adminPage()}
function v(id){return document.getElementById(id).value}
function renderGroups(main){main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Kelompok Binaan</h1><p class="section-lead">Tambah, edit, atau hapus kelompok dan jumlah peserta.</p></div><button class="btn btn-primary" onclick="groupModal()">+ Tambah</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Nama kelompok</th><th>Peserta</th><th>Aksi</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td><b>${esc(g.name)}</b></td><td>${esc(g.people)} orang</td><td><div class="actions"><button class="btn btn-light" onclick="groupModal(${g.id})">Edit</button><button class="btn btn-danger" onclick="delItem('groups',${g.id})">Hapus</button></div></td></tr>`).join("")}</tbody></table></div>`}
function groupModal(id){const g=data.groups.find(x=>x.id==id)||{name:"",people:0};openAdminModal(`<div class="modal-head"><h3>${id?"Edit":"Tambah"} Kelompok</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="form-grid"><div class="field full"><label>Nama kelompok</label><input id="f_name" value="${esc(g.name)}"></div><div class="field"><label>Jumlah peserta</label><input id="f_people" type="number" min="0" value="${esc(g.people)}"></div></div><button class="btn btn-primary" style="margin-top:18px" onclick="saveGroup(${id||0})">Simpan</button>`)}
function saveGroup(id){const obj={id:id||Date.now(),name:v("f_name"),people:Number(v("f_people"))};if(id)data.groups=data.groups.map(x=>x.id==id?obj:x);else data.groups.push(obj);save();closeModal("adminModal");adminPage()}
function renderCrud(main,key,label,fields){main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Kelola ${label}</h1></div><button class="btn btn-primary" onclick="crudModal('${key}')">+ Tambah</button></div><div class="table-wrap"><table class="data-table"><thead><tr>${fields.slice(0,3).map(f=>`<th>${esc(f)}</th>`).join("")}<th>Aksi</th></tr></thead><tbody>${data[key].map(o=>`<tr>${fields.slice(0,3).map(f=>`<td>${esc(o[f])}</td>`).join("")}<td><div class="actions"><button class="btn btn-light" onclick="crudModal('${key}',${o.id})">Edit</button><button class="btn btn-danger" onclick="delItem('${key}',${o.id})">Hapus</button></div></td></tr>`).join("")}</tbody></table></div>`}
function crudModal(key,id){const labels={agendas:"Agenda",reports:"Laporan"};const o=data[key].find(x=>x.id==id)||{};const fs=key==="agendas"?["title","date","month","place","desc"]:["title","date","type","summary"];openAdminModal(`<div class="modal-head"><h3>${id?"Edit":"Tambah"} ${labels[key]}</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="form-grid">${fs.map(f=>`<div class="field ${f==="desc"||f==="summary"?"full":""}"><label>${esc(f)}</label>${f==="desc"||f==="summary"?`<textarea id="f_${f}" rows="4">${esc(o[f]||"")}</textarea>`:`<input id="f_${f}" value="${esc(o[f]||"")}">`}</div>`).join("")}</div><button class="btn btn-primary" style="margin-top:18px" onclick="saveCrud('${key}',${id||0})">Simpan</button>`)}
function saveCrud(key,id){const fs=key==="agendas"?["title","date","month","place","desc"]:["title","date","type","summary"];const o={id:id||Date.now()};fs.forEach(f=>o[f]=v("f_"+f));if(id)data[key]=data[key].map(x=>x.id==id?o:x);else data[key].push(o);save();closeModal("adminModal");adminPage()}

function renderMaterials(main){main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Materi Dakwah & PDF</h1><p class="section-lead">Buat materi teks dan pasang PDF agar masyarakat dapat membaca seluruh halaman langsung di website.</p></div><button class="btn btn-primary" onclick="materialModal()">+ Tambah Materi</button></div><div class="grid-2">${data.materials.map(m=>`<div class="card"><span class="tag">${esc(m.tag)}</span><h3>${esc(m.title)}</h3><p class="section-lead">${esc(m.excerpt)}</p><div class="pdf-status">${m.pdfUrl||m.pdfId?"📄 PDF terpasang — full reader aktif":"📝 Materi teks"}</div><div class="actions"><button class="btn btn-light" onclick="materialModal(${m.id})">Edit</button><button class="btn btn-danger" onclick="delItem('materials',${m.id})">Hapus</button></div></div>`).join("")}</div>`}
function materialModal(id){const m=data.materials.find(x=>x.id==id)||{title:"",tag:"",excerpt:"",content:"",pdfUrl:""};openAdminModal(`<div class="modal-head"><h3>${id?"Edit":"Tambah"} Materi</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="form-grid"><div class="field"><label>Judul</label><input id="f_title" value="${esc(m.title)}"></div><div class="field"><label>Kategori</label><input id="f_tag" value="${esc(m.tag)}"></div><div class="field full"><label>Ringkasan</label><textarea id="f_excerpt" rows="3">${esc(m.excerpt)}</textarea></div><div class="field full"><label>URL PDF dari Vercel Blob / Supabase (opsional)</label><input id="f_pdfUrl" value="${esc(m.pdfUrl||"")}" placeholder="https://.../materi.pdf"><small class="help">Pakai URL ini untuk file besar dan agar PDF dapat dibaca dari semua perangkat.</small></div><div class="field full"><label>Atau upload PDF dari komputer</label><input id="f_pdf" type="file" accept="application/pdf,.pdf"><small class="help">Upload lokal disimpan aman di IndexedDB browser ini. Batas praktis tergantung perangkat/browser.</small></div><div class="field full"><label>Isi materi</label><div class="toolbar"><button type="button" onclick="fmt('bold')"><b>B</b></button><button type="button" onclick="fmt('italic')"><i>I</i></button><button type="button" onclick="fmt('insertUnorderedList')">• List</button><button type="button" onclick="fmt('formatBlock','H2')">H2</button><button type="button" onclick="fmt('formatBlock','H3')">H3</button></div><div class="editor" id="f_content" contenteditable="true">${m.content||""}</div></div></div><button class="btn btn-primary" style="margin-top:18px" onclick="saveMaterial(${id||0})">Simpan Materi</button>`)}
function fmt(cmd,val=null){document.execCommand(cmd,false,val)}
async function saveMaterial(id){const old=data.materials.find(x=>x.id==id)||{};const file=document.getElementById("f_pdf")?.files?.[0];let pdfId=old.pdfId||"";let pdfUrl=v("f_pdfUrl");if(file){if(file.type!=="application/pdf")return toast("File harus PDF");if(cloudMode){try{pdfUrl=await uploadMedia(file,"pdfs")}catch(e){return toast("Upload PDF gagal: "+e.message)}}else{try{pdfId=await putPdf(file)}catch(e){return toast("Upload PDF lokal gagal")}}}const o={id:id||Date.now(),title:v("f_title"),tag:v("f_tag"),excerpt:v("f_excerpt"),content:document.getElementById("f_content").innerHTML,pdfUrl,pdfId};if(id)data.materials=data.materials.map(x=>x.id==id?o:x);else data.materials.push(o);save();closeModal("adminModal");adminPage()}

function renderNews(main){main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Berita Website</h1><p class="section-lead">Berita yang ditambahkan di sini langsung muncul pada bagian “Berita & kegiatan” di halaman utama.</p></div><button class="btn btn-primary" onclick="newsModal()">+ Tambah Berita</button></div><div class="grid-2">${data.news.map(n=>`<div class="card"><span class="tag">${esc(n.category)}</span><h3>${esc(n.title)}</h3><div class="muted-small">${esc(n.date)}</div><p class="section-lead" style="margin-top:8px">${esc(n.excerpt)}</p><div class="actions"><button class="btn btn-light" onclick="newsModal(${n.id})">Edit</button><button class="btn btn-danger" onclick="delItem('news',${n.id})">Hapus</button></div></div>`).join("")}</div>`}
function newsModal(id){const n=data.news.find(x=>x.id==id)||{title:"",date:"",category:"Berita",excerpt:"",content:""};openAdminModal(`<div class="modal-head"><h3>${id?"Edit":"Tambah"} Berita</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="form-grid"><div class="field full"><label>Judul berita</label><input id="f_title" value="${esc(n.title)}"></div><div class="field"><label>Tanggal</label><input id="f_date" value="${esc(n.date)}"></div><div class="field"><label>Kategori</label><input id="f_category" value="${esc(n.category)}"></div><div class="field full"><label>Ringkasan</label><textarea id="f_excerpt" rows="3">${esc(n.excerpt)}</textarea></div><div class="field full"><label>Foto berita</label><input id="f_photo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><small class="help">Foto diupload ke Supabase Storage saat Supabase aktif.</small></div><div class="field full"><label>Isi berita</label><div class="toolbar"><button type="button" onclick="fmt('bold')"><b>B</b></button><button type="button" onclick="fmt('italic')"><i>I</i></button><button type="button" onclick="fmt('insertUnorderedList')">• List</button><button type="button" onclick="fmt('formatBlock','H2')">H2</button><button type="button" onclick="fmt('formatBlock','H3')">H3</button></div><div class="editor" id="f_content" contenteditable="true">${n.content||""}</div></div></div><button class="btn btn-primary" style="margin-top:18px" onclick="saveNews(${id||0})">Simpan Berita</button>`)}
async function saveNews(id){const old=data.news.find(x=>x.id==id)||{};const file=document.getElementById("f_photo")?.files?.[0];let photoUrl=old.photoUrl||"";if(file&&cloudMode){try{photoUrl=await uploadMedia(file,"news")}catch(e){return toast("Upload foto berita gagal: "+e.message)}}else if(file&&!cloudMode){const reader=new FileReader();reader.onload=()=>{saveNewsLocalPhoto(id,reader.result,old)};reader.readAsDataURL(file);return}const o={id:id||Date.now(),title:v("f_title"),date:v("f_date"),category:v("f_category"),excerpt:v("f_excerpt"),content:document.getElementById("f_content").innerHTML,photoUrl};if(id)data.news=data.news.map(x=>x.id==id?o:x);else data.news.unshift(o);save();closeModal("adminModal");adminPage()}
function saveNewsLocalPhoto(id,url,old){const o={id:id||Date.now(),title:v("f_title"),date:v("f_date"),category:v("f_category"),excerpt:v("f_excerpt"),content:document.getElementById("f_content").innerHTML,photoUrl:url};if(id)data.news=data.news.map(x=>x.id==id?o:x);else data.news.unshift(o);save();closeModal("adminModal");adminPage()}

async function submitCatin(e){
  e.preventDefault();
  const get=id=>document.getElementById(id)?.value.trim()||"";
  const nik1=get("catin_nik_suami"), nik2=get("catin_nik_istri");
  if((nik1 && !/^\d{16}$/.test(nik1))||(nik2 && !/^\d{16}$/.test(nik2))) return toast("NIK harus terdiri dari 16 digit angka.");
  const item={createdAt:new Date().toISOString(),status:"Baru",suami:get("catin_suami"),nikSuami:nik1,istri:get("catin_istri"),nikIstri:nik2,ttlSuami:get("catin_ttl_suami"),ttlIstri:get("catin_ttl_istri"),alamat:get("catin_alamat"),whatsapp:get("catin_wa"),tanggal:get("catin_tanggal"),kua:get("catin_kua"),catatan:get("catin_catatan")};
  if(cloudMode){
    try{
      const {error}=await sb.from("catin_submissions").insert({created_at:item.createdAt,status:item.status,suami:item.suami,nik_suami:item.nikSuami,istri:item.istri,nik_istri:item.nikIstri,ttl_suami:item.ttlSuami,ttl_istri:item.ttlIstri,alamat:item.alamat,whatsapp:item.whatsapp,tanggal:item.tanggal,kua:item.kua,catatan:item.catatan});
      if(error) throw error;
      document.getElementById("catinForm")?.reset(); const kua=document.getElementById("catin_kua"); if(kua) kua.value=data.profile.office||"";
      toast("Formulir Catin berhasil disimpan."); return;
    }catch(e){ console.error(e); return toast("Gagal menyimpan formulir: "+e.message); }
  }
  item.id=Date.now(); if(!Array.isArray(data.catinSubmissions)) data.catinSubmissions=[]; data.catinSubmissions.unshift(item); save();
  document.getElementById("catinForm")?.reset(); const kua=document.getElementById("catin_kua"); if(kua) kua.value=data.profile.office||"";
  toast("Formulir Catin tersimpan di browser ini.");
}
function renderCatinAdmin(main){
  const items=data.catinSubmissions||[];
  main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Formulir Catin</h1><p class="section-lead">Data calon pengantin yang masuk melalui formulir online pada perangkat ini.</p></div>${items.length?`<button class="btn btn-danger" onclick="clearCatin()">Hapus semua</button>`:""}</div>
  ${items.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal masuk</th><th>Calon Pengantin</th><th>Rencana Nikah</th><th>WhatsApp</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(new Date(x.createdAt).toLocaleDateString("id-ID"))}</td><td><b>${esc(x.suami)}</b><br>& <b>${esc(x.istri)}</b><br><small>${esc(x.kua)}</small></td><td>${esc(x.tanggal||"-")}</td><td>${esc(x.whatsapp)}</td><td><span class="tag">${esc(x.status||"Baru")}</span></td><td><div class="actions"><button class="btn btn-light" onclick="catinDetail(${x.id})">Lihat</button><button class="btn btn-danger" onclick="deleteCatin(${x.id})">Hapus</button></div></td></tr>`).join("")}</tbody></table></div>`:`<div class="card empty-state"><div class="catin-info-icon">💍</div><h3>Belum ada formulir masuk</h3><p class="section-lead">Formulir yang dikirim masyarakat akan tampil di sini.</p></div>`}`;
}
function catinDetail(id){
  const x=(data.catinSubmissions||[]).find(v=>v.id==id); if(!x)return;
  openAdminModal(`<div class="modal-head"><h3>Detail Formulir Catin</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="catin-detail"><div><b>Calon suami</b><span>${esc(x.suami)}</span></div><div><b>NIK calon suami</b><span>${esc(x.nikSuami)}</span></div><div><b>TTL calon suami</b><span>${esc(x.ttlSuami||"-")}</span></div><div><b>Calon istri</b><span>${esc(x.istri)}</span></div><div><b>NIK calon istri</b><span>${esc(x.nikIstri)}</span></div><div><b>TTL calon istri</b><span>${esc(x.ttlIstri||"-")}</span></div><div class="full"><b>Alamat</b><span>${esc(x.alamat)}</span></div><div><b>WhatsApp</b><span>${esc(x.whatsapp)}</span></div><div><b>Rencana pernikahan</b><span>${esc(x.tanggal||"-")}</span></div><div><b>KUA tujuan</b><span>${esc(x.kua)}</span></div><div class="full"><b>Catatan</b><span>${esc(x.catatan||"-")}</span></div></div><div class="actions" style="margin-top:18px"><button class="btn btn-primary" onclick="updateCatinStatus(${x.id},'Diproses')">Tandai Diproses</button><button class="btn btn-light" onclick="updateCatinStatus(${x.id},'Selesai')">Tandai Selesai</button></div>`);
}
function updateCatinStatus(id,status){data.catinSubmissions=(data.catinSubmissions||[]).map(x=>x.id==id?{...x,status}:x);save();closeModal("adminModal");adminPage();setTimeout(()=>{const b=[...document.querySelectorAll(".side-btn")].find(x=>x.textContent.includes("Formulir Catin"));adminSection("catin",b)},30)}
function deleteCatin(id){if(!confirm("Hapus formulir ini?"))return;data.catinSubmissions=(data.catinSubmissions||[]).filter(x=>x.id!=id);save();adminPage();setTimeout(()=>{const b=[...document.querySelectorAll(".side-btn")].find(x=>x.textContent.includes("Formulir Catin"));adminSection("catin",b)},30)}
function clearCatin(){if(!confirm("Hapus semua data formulir Catin?"))return;data.catinSubmissions=[];save();adminPage()}
function renderGallery(main){main.innerHTML=`<div class="section-head"><div><h1 class="admin-title">Galeri</h1><p class="section-lead">Upload JPG, PNG, WEBP.</p></div><button class="btn btn-primary" onclick="galleryModal()">+ Upload Foto</button></div><div class="gallery">${data.gallery.map(g=>`<div class="gallery-item">${g.src?`<img src="${g.src}" alt="${esc(g.title)}">`:`<div class="gallery-placeholder">✦</div>`}<div class="gallery-overlay">${esc(g.title)} <button style="float:right;border:0;border-radius:8px;padding:4px 7px" onclick='deleteGalleryItem(${JSON.stringify(g.id)})'>×</button></div></div>`).join("")}</div>`}
function galleryModal(){openAdminModal(`<div class="modal-head"><h3>Upload Foto Galeri</h3><button class="btn btn-light" onclick="closeModal('adminModal')">Tutup</button></div><div class="form-grid"><div class="field full"><label>Judul foto</label><input id="f_title" placeholder="Contoh: Pembinaan BKMT"></div><div class="field full"><label>File JPG / PNG / WEBP</label><input id="f_file" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></div></div><button class="btn btn-primary" style="margin-top:18px" onclick="saveGallery()">Upload & Simpan</button>`)}
async function saveGallery(){
  const file=document.getElementById("f_file").files[0];
  if(!file)return toast("Pilih foto terlebih dahulu");
  if(file.size>8*1024*1024)return toast("Foto maksimal 8 MB");
  const title=v("f_title")||file.name;
  if(cloudMode){
    try{
      const rec=await uploadMediaRecord(file,"upload");
      const {data:row,error}=await sb.from("content_items").insert({
        type:"galeri",
        title,
        excerpt:"",
        content:"",
        event_date:new Date().toISOString().slice(0,10),
        file_path:rec.path,
        file_name:file.name,
        file_type:file.type,
        file_size:file.size,
        image_url:rec.publicUrl,
        published:true
      }).select("id").single();
      if(error) throw error;
      data.gallery.unshift({id:row.id,title,date:new Date().toISOString().slice(0,10),src:rec.publicUrl,kind:"image",filePath:rec.path,bucket:rec.bucket});
      save();
      closeModal("adminModal");
      adminPage();
      toast("Foto berhasil disimpan ke Supabase.");
    }catch(e){
      console.error(e);
      toast("Upload galeri gagal: "+e.message);
    }
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    data.gallery.push({id:Date.now(),title,src:reader.result,kind:"image"});
    save();closeModal("adminModal");adminPage()
  };
  reader.readAsDataURL(file);
}
function openAdminModal(html){document.getElementById("adminModalBody").innerHTML=html;document.getElementById("adminModal").classList.add("show")}
async function deleteGalleryItem(id){
  if(!confirm("Hapus foto ini dari Galeri dan Supabase?"))return;
  if(cloudMode && sb && id && !/^\\d+$/.test(String(id))){
    try{
      const {data:row,error:findError}=await sb.from("content_items")
        .select("id,file_path")
        .eq("id",id).eq("type","galeri").maybeSingle();
      if(findError) throw findError;
      if(!row) throw new Error("Data foto tidak ditemukan di content_items.");
      const bucket="website-files";
      if(row.file_path){
        const {error:storageError}=await sb.storage.from(bucket).remove([row.file_path]);
        if(storageError) throw storageError;
      }
      const {error:deleteError}=await sb.from("content_items").delete().eq("id",id).eq("type","galeri");
      if(deleteError) throw deleteError;
      data.gallery=(data.gallery||[]).filter(x=>String(x.id)!==String(id));
      toast("Foto dan file Storage berhasil dihapus.");
      adminPage();
      return;
    }catch(e){
      console.error("Hapus galeri gagal:",e);
      toast("Hapus galeri gagal: "+(e?.message||"Kesalahan Supabase"));
      return;
    }
  }
  if(!confirm("Foto ini adalah foto bawaan website. Hapus dari tampilan?"))return;
  data.gallery=(data.gallery||[]).filter(x=>String(x.id)!==String(id));
  save();adminPage();
}
function delItem(key,id){if(!confirm("Hapus item ini?"))return;data[key]=data[key].filter(x=>x.id!=id);save();adminPage()}
function resetData(){if(!confirm("Kembalikan semua data ke data awal?"))return;data=structuredClone(defaultData);save();adminPage()}
function openAntoChat(){const c=document.getElementById("antoChat");if(!c)return;c.classList.add("show");c.classList.remove("minimized");c.setAttribute("aria-hidden","false");setTimeout(()=>document.getElementById("antoQuestion")?.focus(),150)}
function closeAntoChat(){const c=document.getElementById("antoChat");if(!c)return;c.classList.remove("show");c.setAttribute("aria-hidden","true")}
function minimizeAntoChat(){document.getElementById("antoChat")?.classList.toggle("minimized")}
function addAntoMessage(text,type="in"){const body=document.getElementById("antoChatBody");if(!body)return;const row=document.createElement("div");row.className="anto-msg-row "+(type==="out"?"out":"");row.innerHTML=type==="out"?`<div class="anto-msg-wrap"><div class="anto-msg anto-msg-out">${esc(text).replace(/\n/g,"<br>")}</div><time>Baru saja ✓✓</time></div>`:`<img src="assets/profile.jpg" alt="Sahabat KUA"><div class="anto-msg-wrap"><div class="anto-msg anto-msg-in">${esc(text).replace(/\n/g,"<br>")}</div><time>Baru saja</time></div>`;body.appendChild(row);body.scrollTop=body.scrollHeight;return row}
async function askAnto(topic){const input=document.getElementById("antoQuestion");if(topic)input.value=topic+": ";const q=input?.value.trim();if(!q)return;input.value="";addAntoMessage(q,"out");const typing=addAntoMessage("Sedang saya cek informasinya…","in");typing.classList.add("anto-typing");try{const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,context:{profile:data.profile,materials:data.materials.map(x=>({title:x.title,excerpt:x.excerpt})),office:data.profile.office}})});const json=await res.json();if(!res.ok)throw new Error(json.error||"Permintaan AI gagal");typing.remove();addAntoMessage(json.answer||"Maaf, saya belum menemukan jawabannya. Silakan hubungi KUA untuk memastikan informasi tersebut.","in")}catch(e){
  typing.remove();
  const detail=String(e?.message||"").trim();
  addAntoMessage(
    detail
      ? "Maaf, layanan AI sedang bermasalah.\n\n" + detail + "\n\nSilakan coba lagi beberapa saat."
      : "Maaf, layanan AI sedang bermasalah. Silakan coba lagi beberapa saat.",
    "in"
  );
}}
async function askAI(topic){openAntoChat();return askAnto(topic)}
async function boot(){
  // Render the interface immediately. A slow/blocked Supabase request must never leave a blank screen.
  initSupabase();
  const adminView=location.hash==="#admin"&&isAdmin();
  const routeNews=newsFromPath();
  if(adminView) adminPage(); else {
    publicPage();
    if(routeNews) openNews(routeNews.id,true);
  }
  if(!cloudMode) return;
  try{
    await loadCloud();
    await loadGalleryCloud();
    const {data:session}=await sb.auth.getSession();
    if(session?.session){sessionStorage.setItem(SESSION,"1");await loadCatinCloud();}
    // Refresh the currently visible view after cloud data has arrived.
    if(location.hash==="#admin"&&isAdmin()) adminPage(); else if(location.hash!=="#admin"){
      publicPage();
      const routeNews=newsFromPath();
      if(routeNews) openNews(routeNews.id,true);
    }
  }catch(e){
    console.warn("Cloud hydration gagal:",e);
  }
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop.show").forEach(m=>m.classList.remove("show"));if(e.key==="ArrowLeft"&&document.getElementById("galleryModal")?.classList.contains("show"))galleryPrev();if(e.key==="ArrowRight"&&document.getElementById("galleryModal")?.classList.contains("show"))galleryNext();});
window.addEventListener("hashchange",boot); window.addEventListener("popstate",boot); boot();
