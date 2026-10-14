export function parseAmount(text: string, decimals: number): bigint {
  const input = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(input)) throw Error("Введите положительное число, например 1.5.");
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > decimals) throw Error(`Допустимо не более ${decimals} знаков после запятой.`);
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (value <= 0n || value >= 2n ** 256n) throw Error("Количество вне допустимого диапазона.");
  return value;
}
export function formatAmount(value: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return (value / scale).toString() + (fraction ? "." + fraction : "");
}
