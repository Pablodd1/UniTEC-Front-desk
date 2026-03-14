import React, { useState } from 'react';
import { Product, Language } from '../types';
import { ArrowRight, Search } from 'lucide-react';
import { UI_TRANSLATIONS, PRODUCTS } from '../constants';
import ProductDetail from './ProductDetail';

interface ServicesTabProps {
  language: Language;
  onConsultProduct: (productName: string) => void;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ language, onConsultProduct }) => {
  const t = UI_TRANSLATIONS[language];
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedProduct) {
    return (
      <ProductDetail 
        product={selectedProduct}
        language={language}
        onBack={() => setSelectedProduct(null)}
        onConsult={onConsultProduct}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header & Search */}
      <div className="p-6 bg-white border-b border-slate-100 space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t.productCatalog}</h2>
          <p className="text-sm text-slate-500 font-medium">
            {language === 'en' ? 'Premium materials for your next project' : 'Materiales premium para tu próximo proyecto'}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder={language === 'en' ? "Search materials..." : "Buscar materiales..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        <div className="grid grid-cols-1 gap-5">
          {filteredProducts.map((product) => (
            <div 
              key={product.id} 
              onClick={() => setSelectedProduct(product)}
              className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
            >
              <div className="h-48 bg-slate-200 relative overflow-hidden">
                 <img 
                   src={`https://picsum.photos/seed/${product.id}/600/400`} 
                   alt={product.name}
                   className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                   referrerPolicy="no-referrer"
                 />
                 <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-brand-700 uppercase tracking-widest shadow-sm">
                   {product.category}
                 </div>
              </div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-brand-600 transition-colors">{product.name}</h3>
                  <span className="text-brand-600 font-bold text-sm">{product.price}</span>
                </div>
                
                <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-2">{product.description}</p>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.style_tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      product.stock_status.toLowerCase().includes('stock') || product.stock_status.toLowerCase().includes('disponible')
                        ? 'bg-emerald-500 animate-pulse' 
                        : 'bg-amber-500'
                    }`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.stock_status}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-black text-brand-900 uppercase tracking-widest group-hover:gap-2 transition-all">
                    {t.details} <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search size={32} />
            </div>
            <p className="text-slate-500 font-medium">
              {language === 'en' ? 'No materials found matching your search.' : 'No se encontraron materiales que coincidan con tu búsqueda.'}
            </p>
          </div>
        )}

        <div className="h-8"></div> {/* Spacer */}
      </div>
    </div>
  );
};

export default ServicesTab;
