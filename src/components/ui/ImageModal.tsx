import React, { useState, useEffect, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsMagnifierActive(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMagnifierActive(false);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMagnifierActive(false);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `evidencia_${currentIndex + 1}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMagnifierActive || !containerRef.current) return;

    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = ((e.pageX - left - window.scrollX) / width) * 100;
    const y = ((e.pageY - top - window.scrollY) / height) * 100;

    setMagnifierPos({ x, y, show: true });
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
            className={`p-3 rounded-full transition-all ${isMagnifierActive ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            title={isMagnifierActive ? "Desactivar Lupa" : "Activar Lupa"}
          >
            {isMagnifierActive ? <ZoomOut size={22} /> : <Search size={22} />}
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
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden">
        {/* Navigation Arrows - High z-index and high visibility */}
        {images.length > 1 && (
          <>
            <button 
              onClick={handlePrev}
              className="absolute left-4 z-[1000] p-4 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-2xl"
              title="Anterior (Flecha Izquierda)"
            >
              <ChevronLeft size={40} />
            </button>
            <button 
              onClick={handleNext}
              className="absolute right-4 z-[1000] p-4 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md border border-white/20 shadow-2xl"
              title="Siguiente (Flecha Derecha)"
            >
              <ChevronRight size={40} />
            </button>
          </>
        )}

        {/* Unified Image Container */}
        <div 
          ref={containerRef}
          className="relative w-full max-w-5xl h-full flex items-center justify-center animate-in zoom-in-95 duration-300 pointer-events-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMagnifierPos(prev => ({ ...prev, show: false }))}
          onClick={(e) => e.stopPropagation()}
        >
          <img 
            src={currentImage.url} 
            alt={currentImage.title} 
            className={`max-w-full max-h-[75vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 transition-transform ${isMagnifierActive ? 'cursor-none' : ''}`}
            draggable={false}
          />

          {/* Lupa (Magnifier) Overlay */}
          {isMagnifierActive && magnifierPos.show && (
            <div 
              className="absolute pointer-events-none border-4 border-primary rounded-full shadow-2xl overflow-hidden z-[100] w-64 h-64 md:w-80 md:h-80 transition-opacity duration-200"
              style={{
                left: `${magnifierPos.x}%`,
                top: `${magnifierPos.y}%`,
                transform: 'translate(-50%, -50%)',
                backgroundImage: `url(${currentImage.url})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '800%', // High zoom level
                backgroundPosition: `${magnifierPos.x}% ${magnifierPos.y}%`,
                boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.2)'
              }}
            />
          )}
        </div>
      </div>

      {/* Footer / Thumbnail Previews (Optional placeholder for future) */}
      <div className="absolute bottom-8 flex gap-2">
        {images.map((_, idx) => (
          <div 
            key={idx}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-primary w-6' : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
}
