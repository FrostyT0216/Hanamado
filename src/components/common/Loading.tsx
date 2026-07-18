interface LoadingProps {
  variant?: 'dots' | 'spinner' | 'skeleton';
  text?: string;
  lines?: number;
}

export default function Loading({ variant = 'spinner', text, lines = 3 }: LoadingProps) {
  if (variant === 'dots') {
    return (
      <div className="flex items-center gap-1.5 py-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-apple-text-secondary/40 animate-bounce-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
        {text && <span className="text-xs text-apple-text-secondary ml-1">{text}</span>}
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-black/5 dark:bg-white/10 rounded"
            style={{ width: `${70 + Math.random() * 30}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
      {text && <span className="text-xs text-apple-text-secondary">{text}</span>}
    </div>
  );
}