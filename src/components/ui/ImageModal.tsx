import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Search, ZoomOut } from 'lucide-react';

interface GalleryImage {
  url: string;
  title: string;
}

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: GalleryImage[];
  initialIndex?: number;
}

export function ImageModal({ isOpen, onClose, images, initialIndex = 0 }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0, show: false });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDist, setLastTouchDist] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsMagnifierActive(false);
      setScale(1);
      setPosition({ x: 0, y: 0 });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, initialIndex]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMagnifierActive(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMagnifierActive(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `evidencia_${currentIndex + 1}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Touch handlers para pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDist(dist);
    } else if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleChange = dist / lastTouchDist;
      const newScale = Math.min(Math.max(scale * scaleChange, 1), 4);
      setScale(newScale);
      setLastTouchDist(dist);
    } else if (e.touches.length === 1 && scale > 1) {
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDist(null);
    if (scale < 1.1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 4);
    setScale(newScale);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl transition-all duration-300 animate-in fade-in"
      onClick={onClose}
    >
      {/* Header Info & Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex flex-col">
          <p className="text-primary font-bold text-xs uppercase tracking-widest mb-1">Evidencia Fotográfica</p>
          <h3 className="text-white text-lg font-black italic truncate max-w-[50vw]">
            📍 {currentImage.title}
          </h3>
          <p className="text-white/50 text-xs mt-1">
            Foto {currentIndex + 1} de {images.length}
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMagnifierActive(!isMagnifierActive); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isMagnifierActive ? 'bg-primary text-white shadow-lg shadow-primary/40 scale-105 border-primary' : 'bg-white/10 text-white/70 hover:bg-white/20 border-white/10'} border`}
            title={isMagnifierActive ? "Desactivar Lupa" : "Activar Lupa"}
          >
            {isMagnifierActive ? <ZoomOut size={20} /> : <Search size={20} />}
            <span className="text-sm font-bold truncate">{isMagnifierActive ? 'Lupa: ON' : 'Activar Lupa'}</span>
          </button>
          <button 
            onClick={handleDownload}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white/70 hover:text-white"
            title="Descargar"
          >
            <Download size={22} />
          </button>
          <button 
            onClick={onClose}
            className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-all text-red-500 border border-red-500/30"
            title="Cerrar y regresar"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main Gallery Area */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrows - Siempre visibles si hay más de 1 foto */}
        {images.length > 1 && (
          <>
            <button 
              onClick={handlePrev}
              className="absolute left-6 z-[1000] p-5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-2xl hover:scale-110 active:scale-95"
              title="Anterior (Flecha Izquierda)"
            >
              <ChevronLeft size={44} />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-6 z-[1000] p-5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-2xl hover:scale-110 active:scale-95"
              title="Siguiente (Flecha Derecha)"
            >
              <ChevronRight size={44} />
            </button>
          </>
        )}

        {/* Imagen con zoom táctil */}
        <div 
          ref={containerRef}
          className="relative w-full max-w-5xl h-[70vh] flex items-center justify-center animate-in zoom-in-95 duration-300 pointer-events-auto"
          onWheel={handleWheel}
          onClick={(e) => {
            if (scale > 1) {
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            onMouseDown={(e) => {
              if (scale > 1) {
                setIsDragging(true);
                touchStartRef.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && scale > 1) {
                const deltaX = e.clientX - touchStartRef.current.x;
                const deltaY = e.clientY - touchStartRef.current.y;
                setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
                touchStartRef.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <img 
              src={currentImage.url} 
              alt={currentImage.title} 
              className={`max-w-full max-h-full object-contain rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.6)] border border-white/10 ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
              draggable={false}
            />
          </div>

          {/* Lupa (Magnifier) */}
          {isMagnifierActive && magnifierPos.show && (
            <div 
              className="absolute pointer-events-none border-4 border-primary rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden z-[2000] w-72 h-72 md:w-96 md:h-96"
              style={{
                left: `${magnifierPos.x}%`,
                top: `${magnifierPos.y}%`,
                transform: 'translate(-50%, -50%)',
                backgroundImage: `url(${currentImage.url})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '800%',
                backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* Footer / Indicadores */}
      <div className="absolute bottom-8 flex gap-2">
        {images.map((_, idx) => (
          <div 
            key={idx}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-primary w-6' : 'bg-white/20'}`}
          />
        ))}
      </div>

      {/* Indicador de zoom para móvil */}
      {scale > 1 && (
        <div className="absolute bottom-20 bg-black/60 px-4 py-2 rounded-full flex items-center gap-2">
          <span className="text-white text-sm font-bold">{Math.round(scale * 100)}%</span>
          <button onClick={resetZoom} className="text-primary text-xs font-bold">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
