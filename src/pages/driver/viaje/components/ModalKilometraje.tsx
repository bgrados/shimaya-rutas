import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Truck } from 'lucide-react';

interface ModalKilometrajeProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (km: number) => void;
  valorActual: number;
}

export function ModalKilometraje({ isOpen, onClose, onSave, valorActual }: ModalKilometrajeProps) {
  const [km, setKm] = useState(valorActual.toString());

  useEffect(() => {
    setKm(valorActual.toString());
  }, [valorActual, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const val = parseFloat(km);
    if (!isNaN(val)) {
      onSave(val);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
      <Card className="max-w-xs w-full border-primary/30 bg-surface shadow-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <Truck className="mx-auto text-primary mb-2" size={32} />
            <h3 className="text-lg font-black text-white italic uppercase">Kilometraje Inicial</h3>
            <p className="text-xs text-text-muted">Ingresa el odómetro al salir de planta.</p>
          </div>
          <Input 
            type="number" 
            value={km} 
            onChange={e => setKm(e.target.value)} 
            placeholder="0" 
            className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg text-center" 
          />
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1 text-xs" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 text-xs font-black bg-primary hover:bg-primary-hover" onClick={handleSave}>Guardar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
