import React, { useState, useMemo } from 'react';
import { X, Trash2, Plus, Minus, Truck, CreditCard, Loader2 } from 'lucide-react';
import { CartItem, Language } from '../types';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  language: Language;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ isOpen, onClose, cart, setCart, language }) => {
  const [fullAddress, setFullAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  
  const [shippingResult, setShippingResult] = useState<{ cost: number; carrier: string; days: number } | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState('');

  const brandId = useMemo(() => {
    const brand = new URLSearchParams(window.location.search).get('brandId');
    if (brand === 'building' || brand === 'unitec') return brand;
    if (window.location.hostname.includes('buildinginnovation')) return 'building';
    return 'unitec';
  }, []);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const isCOP = brandId === 'unitec';
      const priceStr = isCOP 
        ? item.product.price.replace(/[^0-9]/g, '') 
        : item.product.price.replace(/[^0-9.]/g, '');
      const price = parseFloat(priceStr) || 0;
      return total + (price * item.quantity);
    }, 0);
  }, [cart, brandId]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ };
      }
      return item;
    }));
    setShippingResult(null);
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    setShippingResult(null);
  };

  const handleCalculateShipping = async () => {
    if (!fullAddress) {
      setError(language === 'en' ? 'Please provide your full address' : 'Por favor ingresa tu dirección completa');
      return;
    }
    setError('');
    setIsCalculatingShipping(true);
    
    try {
      let totalWeightKg = 0;
      let totalVolumeCbm = 0;
      
      for (const item of cart) {
        let unitWeight = 5.0; 
        let unitVolume = 0.02;
        const cat = item.product.category.toUpperCase();
        if (cat.includes("CIELO") || cat.includes("TECHO")) { unitWeight = 3.0; unitVolume = 0.015; }
        else if (cat.includes("PISO") || cat.includes("DECK")) { unitWeight = 12.0; unitVolume = 0.03; }
        else if (cat.includes("CUBIERTA") || cat.includes("ROOF")) { unitWeight = 25.0; unitVolume = 0.1; }
        else if (cat.includes("PARED") || cat.includes("PANEL")) { unitWeight = 8.0; unitVolume = 0.025; }
        else if (cat.includes("CINTA") || cat.includes("PEGANTE")) { unitWeight = 1.0; unitVolume = 0.002; }
        
        totalWeightKg += unitWeight * item.quantity;
        totalVolumeCbm += unitVolume * item.quantity;
      }

      const res = await fetch('/api/calculate-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationZip: '00000',
          destinationCity: 'Bogota',
          destinationState: 'Colombia',
          totalWeightKg,
          totalVolumeCbm
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setShippingResult({ cost: data.shippingCost, carrier: data.carrier, days: data.transitDays });
    } catch (err) {
      console.error(err);
      setError(language === 'en' ? 'Failed to calculate shipping' : 'Error al calcular el envío');
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  const handleCheckout = async () => {
    if (!customerName) {
      setError(language === 'en' ? 'Please provide your name' : 'Por favor provee tu nombre');
      return;
    }
    if (!shippingResult) {
      setError(language === 'en' ? 'Please calculate shipping first' : 'Por favor calcula el envío primero');
      return;
    }

    setIsCheckingOut(true);
    setError('');

    try {
      const cartItemsForApi = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));

      const res = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal,
          shippingCost: shippingResult.cost,
          total: subtotal + shippingResult.cost,
          customerName,
          customerEmail: '',
          cartItems: cartItemsForApi
        })
      });

      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    } catch (err) {
      console.error(err);
      setError(language === 'en' ? 'Failed to initiate checkout' : 'Error al iniciar el pago');
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] transition-opacity"
          onClick={onClose}
        />
      )}
      
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-[210] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {language === 'en' ? 'Shopping Cart' : 'Carrito de Compras'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <Truck size={48} className="mx-auto mb-4 opacity-20" />
              <p>{language === 'en' ? 'Your cart is empty' : 'Tu carrito está vacío'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex bg-white p-4 rounded-2xl border border-slate-100 shadow-sm gap-4 items-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-xl flex-shrink-0 flex items-center justify-center border border-slate-100 overflow-hidden">
                    {false ? (
                      <img src={''} alt={item.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-xs text-slate-400">No Img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{item.product.name}</h3>
                    <p className="text-xs text-slate-500">{item.product.price}</p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-slate-200 rounded-l-lg transition-colors"><Minus size={14} /></button>
                        <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:bg-slate-200 rounded-r-lg transition-colors"><Plus size={14} /></button>
                      </div>
                      <button onClick={() => removeItem(item.product.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && !shippingResult && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Truck size={16} className="text-brand-500" />
                {language === 'en' ? 'Calculate Shipping' : 'Calcular Envío'}
              </h4>
              
              <div className="space-y-3 mb-3">
                <textarea 
                  placeholder={language === 'en' ? 'Full Address, Neighborhood and Municipality' : 'Dirección completa, barrio y municipio'} 
                  value={fullAddress} 
                  onChange={e => setFullAddress(e.target.value)} 
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-brand-500 outline-none resize-none" 
                />
                <p className="text-[10px] text-slate-500 italic font-semibold">
                  ⚠️ {language === 'en' ? 'Shipping validation is subject to logistics.' : 'La validación del flete está sujeta a logística.'}
                </p>
              </div>

              <button 
                onClick={handleCalculateShipping}
                disabled={isCalculatingShipping}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCalculatingShipping ? <Loader2 size={16} className="animate-spin" /> : null}
                {language === 'en' ? 'Get Rates (Walio)' : 'Cotizar Envío (Walio)'}
              </button>
            </div>
          )}

          {shippingResult && (
            <div className="bg-white p-5 rounded-2xl border border-brand-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CreditCard size={16} className="text-brand-500" />
                {language === 'en' ? 'Checkout Details' : 'Detalles de Pago'}
              </h4>
              
              <div className="space-y-3 mb-4">
                <input type="text" placeholder={language === 'en' ? 'Full Name' : 'Nombre Completo'} value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-brand-500 outline-none" />
              </div>

            </div>
          )}
          
          {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {shippingResult && (
              <div className="flex justify-between text-slate-500">
                <span className="flex items-center gap-1">Shipping <span className="text-[10px] bg-slate-100 px-1.5 rounded">{shippingResult.carrier}</span></span>
                <span className="font-medium">${shippingResult.cost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-black text-lg pt-2 border-t border-slate-100">
              <span>Total</span>
              <span>${(subtotal + (shippingResult?.cost || 0)).toFixed(2)} USD</span>
            </div>
          </div>

          <button 
            disabled={cart.length === 0 || !shippingResult || isCheckingOut}
            onClick={handleCheckout}
            className={`w-full py-4 rounded-xl font-black text-white uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 ${cart.length === 0 || !shippingResult || isCheckingOut ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-lg hover:-translate-y-0.5'}`}
          >
            {isCheckingOut ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
            {language === 'en' ? 'Checkout with Stripe' : 'Pagar con Stripe'}
          </button>
        </div>
      </div>
    </>
  );
};

export default CartSidebar;


