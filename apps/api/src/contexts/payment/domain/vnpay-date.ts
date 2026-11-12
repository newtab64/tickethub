/** VNPay su dung mui gio GMT+7, dinh dang yyyyMMddHHmmss. */
export function formatVnpayDate(date: Date): string {
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vietnamTime.toISOString().slice(0, 19).replace(/\D/g, "");
}
