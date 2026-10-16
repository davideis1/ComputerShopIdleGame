export const colors = {
  bg: '#10151c',
  card: '#1b2330',
  text: '#ffffff',
  dim: '#8da0b8',
  accent: '#4da3ff',
  danger: '#e5484d',
  good: '#46c37b',
};
export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
