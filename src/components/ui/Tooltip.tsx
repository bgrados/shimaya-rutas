import { useState, useEffect, useRef, ReactNode } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible && isMobile) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible, isMobile]);

  const handleClick = () => {
    if (isMobile) {
      setIsVisible(!isVisible);
    }
  };

  return (
    <span 
      ref={tooltipRef}
      className={`relative inline-flex items-center cursor-help ${className}`}
      onMouseEnter={() => !isMobile && setIsVisible(true)}
      onMouseLeave={() => !isMobile && setIsVisible(false)}
      onClick={handleClick}
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/30 text-primary hover:bg-primary/50 transition-colors">
        <Info size={14} />
      </span>
      
      {isVisible && (
        <span className="absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 text-xs text-white bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-xl whitespace-normal w-[220px] text-center border border-gray-700/50">
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-gray-900/95" />
        </span>
      )}
    </span>
  );
}

interface TooltipIconProps {
  content: string;
  className?: string;
}

export function TooltipIcon({ content, className = '' }: TooltipIconProps) {
  return (
    <Tooltip content={content} className={className}>
      <span />
    </Tooltip>
  );
}
