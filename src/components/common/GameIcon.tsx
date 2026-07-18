import { ICONS, type IconName } from '@/components/icons/iconData';
import { cn } from '@/utils/cn';

interface GameIconProps {
  name: IconName;
  className?: string;
}

export default function GameIcon({ name, className }: GameIconProps) {
  const svg = ICONS[name];
  if (!svg) return null;

  const html = className
    ? svg.replace('<svg', `<svg class="${cn('inline-block', className)}"`)
    : svg;

  return (
    <span
      className="inline-flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: html }}
      aria-hidden="true"
    />
  );
}
