const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

// Remove " - Parcela X/Y" from description
export function limparDescricao(description: string) {
  if (!description) return '';
  return description.replace(/\s*[-–]\s*(?:Parcela|parcela)\s+\d+\/\d+/i, '').replace(/\(\d{1,3}\/\d{1,3}\)/, '').trim();
}

// "2026-03-04" -> "04/03/2026"
export function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

// "04/03/2026" -> "2026-03-04"
export function parseInputDate(dateStr: string) {
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
