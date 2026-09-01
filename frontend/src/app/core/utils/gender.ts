export function toGenderValue(value: string | null | undefined): string {
  const key = (value || '').trim().toLowerCase();
  if (key === 'male') return 'Male';
  if (key === 'female') return 'Female';
  return '';
}
