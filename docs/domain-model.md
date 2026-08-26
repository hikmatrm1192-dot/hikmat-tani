# Dokumen Domain Model - HIKMAT TANI

**Versi:** 1.0.0  
**Tujuan:** Mendokumentasikan struktur entitas, relasi, dan prinsip domain logic aplikasi pendamping petani padi HIKMAT TANI.

---

## 1. Prinsip Utama Domain Model

1. **Database Boleh Kompleks, Aplikasi Harus Sederhana:**  
   Struktur model data di balik layar mendukung rincian nutrisi, taksonomi OPT, dan pelacakan ilmiah tanpa membebani petani dengan formulir yang rumit di UI.
2. **Petani Adalah Pengambil Keputusan:**  
   Sistem hanya menghasilkan rekomendasi/saran. Keputusan petani dan tindakan riil di sawah dicatat terpisah dan diperlakukan secara terhormat.
3. **Pemisahan Tegas Antara Master Data dan Event Data:**
   * **Master Data:** Data referensi yang relatif statis atau diperbarui berkala (`Fertilizer`, `Opt`, `NaturalEnemy`, `RiceVariety`, `Reference`, `KnowledgeArticle`).
   * **Event / User Data:** Data sejarah dan kejadian yang dicatat petani (`Farmer`, `Land`, `CropSeason`, `Activity`, `FertilizerApplication`, `OptObservation`, `Recommendation`, `FarmerDecision`, `ActualAction`).

---

## 2. Arsitektur Tiga Lapisan Keputusan (Three-Layer Decision Architecture)

Untuk menjaga integritas data dan rasa saling percaya antara sistem dan petani:

```
[ Recommendation ] ────► Disajikan ke Petani sebagai saran santun (Rule-Based)
        │
        ▼
[ FarmerDecision ] ────► Pilihan petani: ACCEPT | ADJUST | REJECT | ALTERNATIVE (+ Catatan)
        │
        ▼
 [ ActualAction ]  ────► Catatan sejarah konkret tindakan yang benar-benar dilakukan di sawah
```

* **Aturan Kritis:** Pembaruan rekomendasi sistem **TIDAK PERNAH** menimpa data `ActualAction`.
* `ActualAction` merupakan rekaman sejarah abadi (*immutable history log*).

---

## 3. Ringkasan Entitas Inti

| Entitas | Tipe | Keterangan |
| :--- | :--- | :--- |
| `Farmer` | User Data | Profil petani minimalis (Nama, Kontak, Wilayah, Kelompok Tani). Tanpa NIK/Password. |
| `Land` | User Data | Petak sawah (Luas dalam Ha, Sumber Air, Jenis Lahan, Koordinat). |
| `CropSeason` | User Data | Musim tanam aktif/selesai. HST tidak disimpan permanen melainkan dihitung dinamis dari `plantingDate`. |
| `Activity` | Event Data | Catatan kegiatan harian (Tanam, Pupuk, Pengairan, OPT, Perawatan, Panen) dengan snapshot HST. |
| `Fertilizer` | Master Data | Katalog pupuk dengan komposisi hara extensible (`N`, `P2O5`, `K2O`, `S`, `Ca`, `Mg`, `Zn`, `Fe`, `B`). |
| `FertilizerApplication` | Event Data | Realisasi pemupukan (Kg pupuk & konversi kg unsur hara aktual). |
| `Opt` | Master Data | Ensiklopedia Hama & Penyakit, gejala, siklus, ambang ekonomi, dan pengendalian. |
| `OptObservation` | Event Data | Pengamatan lapangan. Mendukung opsi `isUnknown: true` untuk petani pemula. |
| `NaturalEnemy` | Master Data | Musuh alami pendukung Pengendalian Hama Terpadu (PHT). |
| `RiceVariety` | Master Data | Varietas padi, umur tanam, dan profil ketahanan. |
| `Reference` | Master Data | Sumber ilmiah/pustaka rujukan untuk setiap data teknis. |
| `KnowledgeArticle` | Master Data | Artikel panduan data-driven yang dapat diperbarui secara dinamis. |
| `SyncOutboxItem` | System / Sync | Antrean mutasi offline dengan `operationId` unik untuk idempotency. |
| `HikmatBackup` | System / Backup | Berkas cadangan terstruktur dengan metadata versi untuk migrasi aman. |

---

## 4. Integritas Offline-First & Idempotency

* Seluruh entitas menggunakan identifier berbasis **UUID v4** yang di-generate di sisi klien.
* Setiap mutasi data dicatat ke dalam `SyncOutboxItem` dengan `operationId` unik untuk mencegah duplikasi data jika koneksi terputus di tengah proses sinkronisasi (*idempotent network requests*).
