import React, { useState } from 'react';
import { Product, Language } from '../types';
import { ArrowLeft, MessageSquare, ShoppingCart, Plus, Minus } from 'lucide-react';
import { UI_TRANSLATIONS } from '../constants';

interface ProductDetailProps {
  product: Product;
  language: Language;
  onBack: () => void;
  onConsult: (productName: string) => void;
  onAddToCart?: (product: Product, quantity: number) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, language, onBack, onConsult, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const t = UI_TRANSLATIONS[language];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          <span>{t.back}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Product Image Area */}
        <div className="bg-slate-50 aspect-square w-full flex items-center justify-center p-8 relative">
          {false ? (
            <img 
              src={''} 
              alt={product.name}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          ) : (
            <div className="text-slate-400 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-200 rounded-full mb-4 flex items-center justify-center">
                <span className="text-3xl font-black text-slate-300">
                  {product.name.charAt(0)}
                </span>
              </div>
              <span className="font-medium text-sm">Image pending</span>
            </div>
          )}
          
          <div className="absolute bottom-4 right-4 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-200 text-xs font-bold text-slate-500">
            {product.id}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <span className="text-xs font-bold text-brand-500 uppercase tracking-wider block mb-2">
                  {product.category}
                </span>
                <h1 className="text-2xl font-black text-slate-900 leading-tight">
                  {product.name}
                </h1>
              </div>
            </div>
            <div className="text-3xl font-black text-brand-600 mt-4">
              {product.price} <span className="text-sm font-medium text-slate-500 uppercase">/ {product.unit}</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Specs Grid */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                {language === 'en' ? 'Specifications' : 'Especificaciones'}
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                {product.dimensions?.latam && (
                  <>
                    <div>
                      <span className="text-slate-500 block mb-1">Ancho</span>
                      <span className="font-bold text-slate-900">{product.dimensions.latam.width_cm} cm</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Largo</span>
                      <span className="font-bold text-slate-900">{product.dimensions.latam.length_cm} cm</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Espesor</span>
                      <span className="font-bold text-slate-900">{product.dimensions.latam.thickness_mm} mm</span>
                    </div>
                  </>
                )}
                {product.items_per_box && (
                  <div>
                    <span className="text-slate-500 block mb-1">Pzas / Caja</span>
                    <span className="font-bold text-slate-900">{product.items_per_box}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {product.style_tags && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.style_tags.map(tag => (
                    <span key={tag} className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="flex gap-3 mb-4">
          {onAddToCart && (
            <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-slate-200 rounded-lg transition-colors"><Minus size={18} /></button>
              <span className="font-bold w-10 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-3 hover:bg-slate-200 rounded-lg transition-colors"><Plus size={18} /></button>
            </div>
          )}
          
          {onAddToCart && (
            <button 
              onClick={() => {
                onAddToCart(product, quantity);
                setQuantity(1);
              }}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 py-3"
            >
              <ShoppingCart size={20} />
              {language === 'en' ? 'Add to Cart' : 'Añadir al Carrito'}
            </button>
          )}
        </div>

        <button 
          onClick={() => onConsult(product.name)}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
        >
          <MessageSquare size={18} />
          {(language === 'en' ? 'Consult AI' : 'Consultar AI')}
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;


