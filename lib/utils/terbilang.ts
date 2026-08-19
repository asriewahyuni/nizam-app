/**
 * Utilitas konversi nominal angka ke kalimat terbilang Rupiah standar Indonesia.
 * Contoh: 2500000 -> "Dua Juta Lima Ratus Ribu Rupiah"
 */

export function angkaKeTerbilang(angka: number): string {
  const bilangan = Math.abs(Math.floor(angka))
  if (bilangan === 0) return 'Nol Rupiah'

  const satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ]

  function konversi(n: number): string {
    if (n < 12) {
      return ' ' + satuan[n]
    } else if (n < 20) {
      return konversi(n - 10) + ' Belas'
    } else if (n < 100) {
      return konversi(Math.floor(n / 10)) + ' Puluh' + konversi(n % 10)
    } else if (n < 200) {
      return ' Seratus' + konversi(n - 100)
    } else if (n < 1000) {
      return konversi(Math.floor(n / 100)) + ' Ratus' + konversi(n % 100)
    } else if (n < 2000) {
      return ' Seribu' + konversi(n - 1000)
    } else if (n < 1000000) {
      return konversi(Math.floor(n / 1000)) + ' Ribu' + konversi(n % 1000)
    } else if (n < 1000000000) {
      return konversi(Math.floor(n / 1000000)) + ' Juta' + konversi(n % 1000000)
    } else if (n < 1000000000000) {
      return konversi(Math.floor(n / 1000000000)) + ' Miliar' + konversi(n % 1000000000)
    } else if (n < 1000000000000000) {
      return konversi(Math.floor(n / 1000000000000)) + ' Triliun' + konversi(n % 1000000000000)
    }
    return ''
  }

  const hasil = konversi(bilangan).trim()
  return `${hasil} Rupiah`
}
