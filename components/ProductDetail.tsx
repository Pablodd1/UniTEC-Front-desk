import React from 'react';
import { Product, Language } from '../types';
import { UI_TRANSLATIONS } from '../constants';
import { ArrowLeft, ExternalLink, Tag, Package, Info, DollarSign } from 'lucide-react';

interface ProductDetailProps {
  product: Product;
  language: Language;
  onBack: () => void;
  onConsult: (productName: string) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, language, onBack, onConsult }) => {
  const t = UI_TRANSLATIONS[language];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 truncate">{product.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Hero Image */}
        <div className="h-64 bg-gray-100 relative">
          <img 
            src={`https://picsum.photos/seed/${product.id}/800/600`} 
            alt={product.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-black text-brand-700 shadow-sm border border-white/20">
            {product.category}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Title & Price */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight mb-2 uppercase tracking-tight">{product.name}</h1>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <DollarSign size={18} />
                <span className="text-xl">{product.price || 'Contact for Price'}</span>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
              product.stock_status.toLowerCase().includes('stock') || product.stock_status.toLowerCase().includes('disponible')
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {product.stock_status}
            </div>
          </div>

          {/* Technical Specs Grid */}
          {product.dimensions && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimensions (LATAM)</p>
                <p className="text-slate-900 font-bold text-sm">
                  {product.dimensions.latam.width_cm} x {product.dimensions.latam.length_cm} cm
                </p>
                <p className="text-[10px] text-slate-500">{product.dimensions.latam.thickness_mm} mm thickness</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimensions (USA)</p>
                <p className="text-slate-900 font-bold text-sm">
                  {product.dimensions.usa.width_in} in x {product.dimensions.usa.length_ft} ft
                </p>
                <p className="text-[10px] text-slate-500">{product.dimensions.usa.thickness_in} in thickness</p>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-900">
              <Info size={18} />
              <h3 className="font-bold uppercase tracking-widest text-xs">{t.description}</h3>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Style Tags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-900">
              <Tag size={18} />
              <h3 className="font-bold uppercase tracking-widest text-xs">{t.styleTags}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.style_tags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Technical Sheet */}
          {product.pdf_tech_sheet && (
            <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-center justify-between group cursor-pointer hover:bg-brand-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-900 text-accent-500 rounded-xl flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-900 uppercase tracking-widest">{t.techSheet}</p>
                  <p className="text-[10px] text-brand-600">PDF Document • 2.4 MB</p>
                </div>
              </div>
              <ExternalLink size={18} className="text-brand-400 group-hover:text-brand-600 transition-colors" />
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4">
            <button 
              onClick={() => onConsult(product.name)}
              className="w-full py-4 bg-brand-900 text-accent-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-800 transition-all active:scale-95 shadow-lg shadow-brand-900/20"
            >
              {language === 'en' ? 'Consult with AI Assistant' : 'Consultar con Asistente IA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
