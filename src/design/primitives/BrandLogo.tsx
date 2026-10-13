import { getBrandLogo } from '../../lib/brandLogos';

interface Props {
  brand: string;
  /** Nome dell'impianto: alcuni marchi stanno li e non nel campo brand. */
  name?: string;
  size?: number;
  className?: string;
}

export function BrandLogo({ brand, name, size = 40, className }: Props) {
  const src = getBrandLogo(brand || name || '');
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--mf-ground)',
        border: '1px solid var(--mf-hairline)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={brand || 'Indipendente'}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(.82)' }}
      />
    </span>
  );
}
