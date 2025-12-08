import React from 'react';
import { BusinessConfig } from '../types';
import { MapPin, Phone, Instagram, Clock, Mail } from 'lucide-react';

interface InfoTabProps {
  config: BusinessConfig;
}

const InfoTab: React.FC<InfoTabProps> = ({ config }) => {
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
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Contact Information</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-400">WhatsApp</p>
                <p className="font-semibold text-gray-800">{config.contact.whatsapp}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <Instagram size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Instagram</p>
                <p className="font-semibold text-gray-800">{config.contact.instagram}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
             🔥 Current Promotions
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
             <Clock size={16} /> Business Hours
           </h3>
           <div className="space-y-2 text-sm text-gray-600">
             <div className="flex justify-between">
               <span>Monday - Friday</span>
               <span className="font-semibold">9:00 AM - 5:00 PM</span>
             </div>
             <div className="flex justify-between">
               <span>Saturday</span>
               <span className="font-semibold">By Appointment</span>
             </div>
             <div className="flex justify-between">
               <span>Sunday</span>
               <span className="text-red-400">Closed</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default InfoTab;