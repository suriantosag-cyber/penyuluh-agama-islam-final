```javascript
async function deleteGalleryItem(id) {
  if (!id) {
    alert("ID foto tidak ditemukan.");
    return;
  }

  const confirmed = confirm(
    "Apakah Anda yakin ingin menghapus foto ini?\n\nFoto akan dihapus dari Galeri dan penyimpanan."
  );

  if (!confirmed) return;

  try {
    // Cari data foto terlebih dahulu
    let item = null;

    // Jika menggunakan Supabase
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("content_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Gagal mencari data foto:", error);
        throw new Error("Gagal mengambil data foto dari Supabase.");
      }

      item = data;
    }

    // Ambil file_path dari data Supabase/local data
    const filePath =
      item?.file_path ||
      item?.image_path ||
      item?.storage_path ||
      item?.path ||
      null;

    // 1. Hapus file dari Supabase Storage
    if (window.supabaseClient && filePath) {
      // Pastikan hanya path file yang dikirim ke remove()
      let cleanPath = String(filePath);

      // Jika yang tersimpan berupa URL lengkap, ambil bagian setelah /object/public/
      const publicMarker = "/storage/v1/object/public/website-files/";
      const signedMarker = "/storage/v1/object/sign/website-files/";

      if (cleanPath.includes(publicMarker)) {
        cleanPath = cleanPath.split(publicMarker)[1];
      } else if (cleanPath.includes(signedMarker)) {
        cleanPath = cleanPath.split(signedMarker)[1];
      }

      cleanPath = cleanPath.split("?")[0];

      const { error: storageError } =
        await window.supabaseClient.storage
          .from("website-files")
          .remove([cleanPath]);

      if (storageError) {
        console.warn(
          "File Storage tidak berhasil dihapus:",
          storageError
        );
      }
    }

    // 2. Hapus data foto dari tabel content_items
    if (window.supabaseClient) {
      const { error: deleteError } =
        await window.supabaseClient
          .from("content_items")
          .delete()
          .eq("id", id);

      if (deleteError) {
        console.error(
          "Gagal menghapus data foto:",
          deleteError
        );
        throw new Error(
          "Data foto gagal dihapus dari database: " +
            deleteError.message
        );
      }
    }

    // 3. Hapus dari data lokal jika aplikasi menggunakan localStorage
    try {
      const possibleKeys = [
        "gallery",
        "galleryItems",
        "content_items",
        "contentItems",
        "items"
      ];

      possibleKeys.forEach((key) => {
        const raw = localStorage.getItem(key);

        if (!raw) return;

        try {
          const parsed = JSON.parse(raw);

          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (entry) => String(entry?.id) !== String(id)
            );

            localStorage.setItem(
              key,
              JSON.stringify(filtered)
            );
          }
        } catch (e) {
          console.warn(
            "Data localStorage bukan JSON:",
            key
          );
        }
      });
    } catch (localError) {
      console.warn(
        "Pembersihan localStorage dilewati:",
        localError
      );
    }

    // 4. Hapus elemen foto dari halaman
    const selectors = [
      `[data-id="${id}"]`,
      `[data-gallery-id="${id}"]`,
      `#gallery-${id}`,
      `#gallery-item-${id}`
    ];

    selectors.forEach((selector) => {
      document
        .querySelectorAll(selector)
        .forEach((element) => element.remove());
    });

    // 5. Jika aplikasi mempunyai fungsi render/load Galeri,
    // jalankan kembali agar tampilan benar-benar sinkron.
    if (typeof loadGallery === "function") {
      await loadGallery();
    } else if (typeof renderGallery === "function") {
      await renderGallery();
    } else if (typeof renderAdmin === "function") {
      await renderAdmin();
    }

    alert("Foto berhasil dihapus dari Galeri.");

  } catch (error) {
    console.error("deleteGalleryItem error:", error);

    alert(
      "Foto gagal dihapus.\n\n" +
      (error?.message || "Terjadi kesalahan.")
    );
  }
}
```
