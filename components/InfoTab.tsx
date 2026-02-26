import React from 'react';
import { BusinessConfig, Language } from '../types';
import { MapPin, Instagram, Clock, MessageCircle } from 'lucide-react';
import { UI_TRANSLATIONS } from '../constants';

interface InfoTabProps {
  config: BusinessConfig;
  language: Language;
}

const InfoTab: React.FC<InfoTabProps> = ({ config, language }) => {
  const t = UI_TRANSLATIONS[language];

  // Format WhatsApp number for API (remove spaces/symbols)
  const waNumber = config.contact.whatsapp.replace(/[^0-9]/g, '');

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      {/* Hero Header */}
      <div className="bg-brand-900 text-white p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-brand-500 to-transparent"></div>
        <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">{config.name}</h2>
            <p className="text-brand-200 text-sm font-light">{config.tagline}</p>
        </div>
      </div>

      <div className="p-4 -mt-6 relative z-20 space-y-4">
        
        {/* Contact Card */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t.contactInfo}</h3>
          
          <div className="space-y-4">
            {/* Clickable WhatsApp Integration */}
            <a 
              href={`https://wa.me/${waNumber}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 group p-2 -mx-2 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-colors">
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">WhatsApp (Chat with us)</p>
                <p className="font-semibold text-gray-800 flex items-center gap-2">
                    {config.contact.whatsapp}
                </p>
              </div>
            </a>

            <div className="flex items-center gap-4 p-2 -mx-2">
              <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <Instagram size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Instagram</p>
                <p className="font-semibold text-gray-800">{config.contact.instagram}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-2 -mx-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Location</p>
                <p className="font-semibold text-gray-800">{config.contact.location}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Promotions */}
        <div className="bg-gradient-to-br from-accent-500 to-orange-500 rounded-xl shadow-md p-5 text-white">
           <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
             🔥 {t.promotions}
           </h3>
           <ul className="list-disc list-inside space-y-1 text-sm font-medium opacity-90">
             {config.promotions.map((promo, i) => (
               <li key={i}>{promo}</li>
             ))}
           </ul>
        </div>

        {/* Hours (Static for now based on typical business) */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
           <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
             <Clock size={16} /> {t.businessHours}
           </h3>
           <div className="space-y-2 text-sm text-gray-600">
             <div className="flex justify-between">
               <span>{t.monFri}</span>
               <span className="font-semibold">9:00 AM - 5:00 PM</span>
             </div>
             <div className="flex justify-between">
               <span>{t.sat}</span>
               <span className="font-semibold">{t.byAppt}</span>
             </div>
             <div className="flex justify-between">
               <span>{t.sun}</span>
               <span className="text-red-400">{t.closed}</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default InfoTab;