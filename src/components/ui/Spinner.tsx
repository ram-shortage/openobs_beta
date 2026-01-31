import { cn } from '../../lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  const sizeStyles = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        role="status"
        aria-label={label || 'Loading'}
        className={cn(
          'animate-spin rounded-full',
          'border-background-modifier-border',
          'border-t-interactive-accent',
          sizeStyles[size]
        )}
      />
      {label && <span className="text-sm text-text-muted">{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
}

// Full page spinner overlay
export interface SpinnerOverlayProps extends SpinnerProps {
  isVisible: boolean;
}

export function SpinnerOverlay({
  isVisible,
  size = 'lg',
  label,
}: SpinnerOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-primary/80 backdrop-blur-sm">
      <Spinner size={size} label={label} />
    </div>
  );
}
