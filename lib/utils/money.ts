/**
 * VND formatting. VND is zero-decimal, so we never render fractional part.
 *
 * Examples:
 *   formatVND(1500000)  => "1.500.000 ₫"
 *   formatVND(0)        => "0 ₫"
 *   formatVND(-200000)  => "-200.000 ₫"    (caller controls sign)
 */
const formatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVND(amount: number): string {
  return formatter.format(amount);
}
