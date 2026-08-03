/** UTC+8 自然日键，格式 YYYY-MM-DD */
export function usageDateKey(now = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
