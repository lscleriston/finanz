import { ACCOUNT_COLORS } from './constants';

export const SIDEBAR_BG = '#0f1210';

export function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDayLabel(isoDate: string) {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch (e) {
    return isoDate;
  }
}

export function limparDescricao(description: string) {
  if (!description) return '';
  return description.replace(/\s*[-–]\s*(?:Parcela|parcela)\s+\d+\/\d+/i, '').replace(/\(\d{1,3}\/\d{1,3}\)/, '').trim();
}

export { ACCOUNT_COLORS };
