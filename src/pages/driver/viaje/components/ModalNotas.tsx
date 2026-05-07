import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { X } from 'lucide-react';

interface ModalNotasProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nota: string) => void;
  titulo: string;
  valorActual: string;
}

export function ModalNotas({ isOpen, onClose, onSave, titulo, valorActual }: ModalNotasProps) {
  const [nota, setNota] = useState(valorActual);

  useEffect(() => {
    setNota(valorActual);
  }, [valorActual, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/30 bg-surface shadow-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-white italic uppercase">
              {titulo}
            </h3>
            <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Escribe una observación o nota sobre esta visita..."
            className="w-full h-32 bg-surface-light border border-white/10 rounded-lg p-3 text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-primary/50"
          />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1 text-xs" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary hover:bg-primary-hover font-black text-xs" onClick={() => onSave(nota)}>Guardar Nota</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
