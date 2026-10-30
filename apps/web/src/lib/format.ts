export function formatUnitLevel(level: string): string {
  const labels: Record<string, string> = { TK: "Taman Kanak-kanak", SD: "Sekolah Dasar", SMP: "Sekolah Menengah Pertama", SMA: "Sekolah Menengah Atas", SLB: "Sekolah Luar Biasa" };
  return labels[level] ?? level;
}
