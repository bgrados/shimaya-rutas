import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, title }: ImageModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `evidencia_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="relative max-w-[95vw] max-h-[90vh] flex flex-col items-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Buttons */}
        <div className="absolute -top-12 right-0 flex gap-4">
          <button 
            onClick={handleDownload}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
            title="Descargar"
          >
            <Download size={24} />
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Image */}
        <img 
          src={imageUrl} 
          alt={title || "Vista ampliada"} 
          className="rounded-lg shadow-2xl object-contain w-full h-full max-h-[85vh] border border-white/10"
        />

        {/* Title */}
        {title && (
          <div className="mt-4 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full">
            <p className="text-white text-sm font-medium">📍 {title}</p>
          </div>
        )}
      </div>
    </div>
  );
}
