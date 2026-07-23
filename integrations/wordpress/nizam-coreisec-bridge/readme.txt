=== Nizam Coreisec Bridge ===
Contributors: nizam
Requires at least: 6.0
Requires PHP: 7.4
Stable tag: 1.0.0

Bridge satu arah untuk masa paralel Coreisec ke Nizam.

== Pemasangan Aman ==

1. Salin folder plugin ke wp-content/plugins.
2. Tambahkan secret acak minimal 32 karakter ke wp-config.php:
   define('NIZAM_BRIDGE_SECRET', getenv('NIZAM_BRIDGE_SECRET'));
3. Aktifkan plugin hanya setelah backup database dan uji staging.
4. Nizam menarik event melalui endpoint REST /wp-json/nizam-bridge/v1/outbox.
5. Nizam mengirim ACK hanya sesudah event tersimpan dan diproses sukses.

Plugin tidak pernah menulis kembali ke tabel Sejoli/LearnPress. Tabel outbox tidak
dihapus saat plugin dinonaktifkan agar jejak audit tetap ada.
