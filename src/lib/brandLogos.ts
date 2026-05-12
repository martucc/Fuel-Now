export const getBrandLogo = (brand: string): string => {
  const b = brand.toLowerCase().trim();
  
  // Local premium assets (White on Black)
  if (b.includes('eni')) return 'assets/logos/eni.png';
  if (b.includes('agip')) return 'assets/logos/agip.png';
  if (b.includes('q8') || b.includes('kuwait')) return 'assets/logos/q8.png';
  if (b.includes('esso')) return 'assets/logos/esso.png';
  if (b.includes('ip') || b.includes('api') || b.includes('italiana petroli')) return 'assets/logos/ip.png';
  if (b.includes('tamoil')) return 'assets/logos/tamoil.png';
  if (b.includes('shell')) return 'assets/logos/shell.png';
  if (b.includes('conad')) return 'assets/logos/conad.png';
  if (b.includes('coop') || b.includes('enercoop')) return 'assets/logos/coop.png';
  if (b.includes('repsol')) return 'assets/logos/repsol.png';
  
  return 'assets/logos/generic.png';
};
