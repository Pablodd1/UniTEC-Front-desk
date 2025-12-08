import React from 'react';
import { ServiceOffering } from '../types';
import { Check, ArrowRight } from 'lucide-react';

interface ServicesTabProps {
  services: ServiceOffering[];
}

const ServicesTab: React.FC<ServicesTabProps> = ({ services }) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 no-scrollbar">
      <div className="space-y-1 mb-6">
        <h2 className="text-xl font-bold text-brand-900">Product Catalog</h2>
        <p className="text-sm text-gray-500">Premium materials for your next project</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {services.map((service) => (
          <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-32 bg-gray-200 relative">
               {/* Placeholder for Product Image using Placehold.co or Picsum */}
               <img 
                 src={`https://picsum.photos/seed/${service.id}/400/200`} 
                 alt={service.name}
                 className="w-full h-full object-cover"
               />
               <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-brand-700">
                 {service.category}
               </div>
            </div>
            
            <div className="p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-1">{service.name}</h3>
              <p className="text-sm text-gray-600 leading-snug mb-3">{service.description}</p>
              
              <div className="space-y-1.5 mb-4">
                {service.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check size={14} className="text-accent-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-500">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-brand-700">{service.pricing}</span>
                <button className="text-xs bg-gray-50 text-gray-900 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-gray-100 font-medium">
                  Details <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="h-8"></div> {/* Spacer */}
    </div>
  );
};

export default ServicesTab;