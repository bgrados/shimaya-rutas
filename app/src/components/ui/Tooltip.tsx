import { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2
      });
    }
  }, []);

  const showTooltip = () => {
    updatePosition();
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

  const handleClick = () => {
    if (isMobile) {
      updatePosition();
      setIsVisible(!isVisible);
    }
  };

  return (
    <>
      <span 
        ref={triggerRef}
        className={`relative inline-flex items-center cursor-help ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={handleClick}
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/30 text-primary hover:bg-primary/50 transition-colors">
          <Info size={14} />
        </span>
      </span>
      
      {isVisible && createPortal(
        <div 
          className="fixed px-3 py-2.5 text-xs text-white bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-xl whitespace-normal w-[220px] text-center border border-gray-700/50 z-[99999]"
          style={{ 
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)'
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
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
