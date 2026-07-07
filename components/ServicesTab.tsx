import React, { useState } from 'react';
import { Product, Language } from '../types';
import { ArrowRight, Search } from 'lucide-react';
import { UI_TRANSLATIONS, PRODUCTS } from '../constants';
import ProductDetail from './ProductDetail';

interface ServicesTabProps {
  language: Language;
  onConsultProduct: (productName: string) => void;
  onAddToCart?: (product: Product, quantity: number) => void;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ language, onConsultProduct, onAddToCart }) => {
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
        onAddToCart={onAddToCart}
      />
    );
  }

  // Define subcategories based on the actual products
  const interiorProducts = filteredProducts.filter(p => p.collection === 'INTERIOR');
  const exteriorProducts = filteredProducts.filter(p => p.collection === 'EXTERIOR');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-brand-600 text-white p-6 pb-8 shrink-0">
        <h2 className="text-2xl font-black mb-2">{t.navServices}</h2>
        <p className="text-brand-100 text-sm">
          {language === 'en' 
            ? 'Explore our premium building materials collection' 
            : 'Explora nuestra colección de materiales premium'}
        </p>

        {/* Search Bar */}
        <div className="mt-6 relative">
          <input
            type="text"
            placeholder={language === 'en' ? 'Search products...' : 'Buscar productos...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-brand-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:bg-white/20 transition-colors"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-200" size={18} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 -mt-4">
        {/* INTERIOR COLLECTION */}
        {interiorProducts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2">
              Interior Collection
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {interiorProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-2xl p-4 border border-slate-200 text-left hover:border-brand-500 hover:shadow-lg transition-all group flex flex-col h-full"
                >
                  <div className="h-24 bg-slate-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url.includes('drive.google.com/file/d/') ? `https://drive.google.com/uc?export=view&id=${product.image_url.split('/d/')[1].split('/')[0]}` : product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="text-xs text-slate-400 font-medium">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider block mb-1">
                      {product.category}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-2 line-clamp-2">
                      {product.name}
                    </h4>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{product.price}</span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EXTERIOR COLLECTION */}
        {exteriorProducts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-2">
              Exterior Collection
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {exteriorProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white rounded-2xl p-4 border border-slate-200 text-left hover:border-brand-500 hover:shadow-lg transition-all group flex flex-col h-full"
                >
                  <div className="h-24 bg-slate-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url.includes('drive.google.com/file/d/') ? `https://drive.google.com/uc?export=view&id=${product.image_url.split('/d/')[1].split('/')[0]}` : product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <div className="text-xs text-slate-400 font-medium">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider block mb-1">
                      {product.category}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-2 line-clamp-2">
                      {product.name}
                    </h4>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">{product.price}</span>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {language === 'en' ? 'No products found' : 'No se encontraron productos'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesTab;



