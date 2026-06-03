import type { CSSProperties } from 'react';
import type { LinkQuality } from '@shared/types/datalink';
import './SignalLamp.css';

const QUALITY_COLOR: Record<LinkQuality, string> = {
  good: 'var(--signal-good)',
  degraded: 'var(--signal-degraded)',
  poor: 'var(--signal-poor)',
  offline: 'var(--signal-offline)',
};

interface Props {
  quality: LinkQuality;
  title: string;
}

export function SignalLamp({ quality, title }: Props) {
  return (
    <span
      className="signal-lamp"
      style={{ '--lamp-color': QUALITY_COLOR[quality] } as CSSProperties}
      title={title}
      aria-label={title}
    />
  );
}
