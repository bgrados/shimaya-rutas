const KEY = 'descanso_confirmado_fecha';

export const getDescansoConfirmado = (): boolean => {
  const guardado = localStorage.getItem(KEY);
  const hoy = new Date().toISOString().split('T')[0];
  return guardado === hoy;
};

export const setDescansoConfirmado = () => {
  const hoy = new Date().toISOString().split('T')[0];
  localStorage.setItem(KEY, hoy);
};

export const clearDescansoConfirmado = () => {
  localStorage.removeItem(KEY);
};