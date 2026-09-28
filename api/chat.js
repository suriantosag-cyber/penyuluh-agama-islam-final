export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, context = {} } = req.body || {};
    if (!message || !String(message).trim()) return res.status(400).json({ error: "Pertanyaan kosong" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY belum diatur di Vercel." });

    const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const fallbacks = [
      primary,
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite"
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    const systemInstruction = [
      "Anda adalah Sahabat KUA, asisten Tanya Jawab AI KUA untuk Portal Penyuluh Agama Islam KUA Kecamatan Panca Lautang.",
      "Jawab bahasa Indonesia dengan sopan, ramah, alami, jelas, singkat, dan praktis.",
      "Fokus pada pernikahan, persyaratan nikah, wali dan saksi, buku nikah, rujuk, isbat nikah, keluarga sakinah, dan layanan KUA.",
      "Untuk persyaratan administratif yang dapat berubah, jangan mengarang; sarankan konfirmasi ke KUA Panca Lautang untuk ketentuan terbaru.",
      "Jika di luar materi KUA, tetap membantu bila memungkinkan dan jangan mengaku sebagai petugas resmi.",
      `Konteks portal: ${JSON.stringify(context)}`
    ].join(" ");

    let lastError = null;

    for (const model of fallbacks) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);

        let response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: [{ role: "user", parts: [{ text: String(message).trim() }] }],
                generationConfig: { maxOutputTokens: 800, temperature: 0.6 }
              }),
              signal: controller.signal
            }
          );
        } finally {
          clearTimeout(timer);
        }

        const data = await response.json();

        if (!response.ok) {
          lastError = data?.error?.message || `Gemini ${model} gagal (${response.status})`;
          // Capacity/rate-limit/server failures: try next model automatically.
          if ([408, 409, 429, 500, 502, 503, 504].includes(response.status)) continue;
          return res.status(response.status).json({ error: lastError });
        }

        const answer = (data?.candidates || [])
          .flatMap(c => c?.content?.parts || [])
          .map(p => typeof p?.text === "string" ? p.text.trim() : "")
          .filter(Boolean)
          .join("\n\n")
          .trim();

        if (answer) return res.status(200).json({ answer, model });
        lastError = `Gemini ${model} tidak mengembalikan teks.`;
      } catch (e) {
        lastError = e?.name === "AbortError"
          ? `Gemini ${model} timeout`
          : (e?.message || `Gemini ${model} error`);
      }
    }

    return res.status(503).json({
      error: "Semua model AI sedang penuh atau sementara tidak tersedia. Silakan coba lagi beberapa saat."
    });
  } catch (e) {
    console.error("/api/chat error:", e);
    return res.status(500).json({ error: e?.message || "Server error pada layanan AI" });
  }
}
