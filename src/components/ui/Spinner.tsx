import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'animate-spin rounded-full border-gray-200 border-t-red-600',
          sizeClasses[size],
          className
        )
      )}
    />
  );
}