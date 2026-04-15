import { useState, useRef, ReactNode } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  iconOnly?: boolean;
  className?: string;
}

export function Tooltip({ content, children, iconOnly = false, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, 200);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  return (
    <span 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children || (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-help">
          <Info size={12} />
        </span>
      )}
      
      {isVisible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap max-w-[250px]">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

interface CardTooltipProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function CardWithTooltip({ title, description, children, className = '' }: CardTooltipProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <span className="absolute top-2 right-2 z-10">
        <Tooltip content={description} />
      </span>
    </div>
  );
}
