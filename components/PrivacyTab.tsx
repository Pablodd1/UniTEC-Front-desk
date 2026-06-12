import React from 'react';
import { Language, BusinessConfig } from '../types';

interface PrivacyTabProps {
  language: Language;
  config: BusinessConfig;
}

const PrivacyTab: React.FC<PrivacyTabProps> = ({ language, config }) => {
  const isEn = language === 'en';
  const brand = config.name;

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-brand-900 text-white p-6 shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-300">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            </svg>
          </div>
          <h2 className="text-2xl font-black mb-1">
            {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
          </h2>
          <p className="text-brand-200 text-sm font-medium">
            {isEn ? 'Information Processing and Data Protection' : 'Tratamiento de Información y Protección de Datos'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-20 space-y-8 text-slate-700 leading-relaxed text-sm">
        
        {/* Intro */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
            {isEn ? 'Authorization and Privacy Notice' : 'Autorización y aviso de privacidad'}
          </h3>
          <p>
            {isEn 
              ? `The company ${brand}, in compliance with the provisions of Law 1581 of 2012 and Decree 1074 of 2015, is responsible for processing collected personal data.`
              : `La empresa ${brand}, en cumplimiento de lo dispuesto en la Ley 1581 de 2012 y el Decreto 1074 de 2015, es responsable del tratamiento de los datos personales recolectados.`}
          </p>
        </section>

        {/* Purpose */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
            {isEn ? 'Purpose of Data Processing' : 'Finalidad del tratamiento de datos'}
          </h3>
          <p className="mb-4">
            {isEn 
              ? 'The personal data collected will be used for the following purposes:'
              : 'Los datos personales recolectados serán utilizados para las siguientes finalidades:'}
          </p>
          <ul className="space-y-3">
            {[
              isEn ? 'Establish communication with potential and current clients.' : 'Establecer comunicación con clientes potenciales y actuales.',
              isEn ? 'Send commercial, promotional, and advertising information about products and services.' : 'Enviar información comercial, promocional y publicitaria sobre productos y servicios.',
              isEn ? 'Follow up on requests, quotes, or commercial processes.' : 'Realizar seguimiento a solicitudes, cotizaciones o procesos comerciales.',
              isEn ? 'Manage contractual and commercial relationships.' : 'Gestionar relaciones contractuales y comerciales.',
              isEn ? 'Execute marketing strategies through different channels (email, calls, SMS, WhatsApp, and social networks).' : 'Ejecutar estrategias de marketing a través de diferentes canales (correo electrónico, llamadas, SMS, WhatsApp y redes sociales).'
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0"></div>
                <span className="text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Rights */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
            {isEn ? 'Rights of the Data Owner' : 'Derechos del titular de los datos'}
          </h3>
          <p className="mb-4">
            {isEn 
              ? 'As the owner of the information, you have the right to:'
              : 'Como titular de la información, usted tiene derecho a:'}
          </p>
          <ul className="space-y-3">
            {[
              isEn ? 'Know, update, and rectify your personal data.' : 'Conocer, actualizar y rectificar sus datos personales.',
              isEn ? 'Request proof of the authorization granted.' : 'Solicitar prueba de la autorización otorgada.',
              isEn ? 'Be informed about the use given to your data.' : 'Ser informado sobre el uso que se le ha dado a sus datos.',
              isEn ? 'Revoke the authorization and/or request the deletion of data when legal principles are not respected.' : 'Revocar la autorización y/o solicitar la supresión del dato cuando no se respeten los principios legales.',
              isEn ? 'Access your personal data free of charge.' : 'Acceder en forma gratuita a sus datos personales.'
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0"></div>
                <span className="text-slate-600">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Authorization */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
            {isEn ? 'Owner Authorization' : 'Autorización del titular'}
          </h3>
          <p>
            {isEn 
              ? `By providing their personal data by any means, the owner freely, previously, expressly, and informedly authorizes ${brand} to process them according to the purposes described herein.`
              : `Al suministrar sus datos personales por cualquier medio, el titular autoriza de manera libre, previa, expresa e informada a ${brand} para realizar el tratamiento de los mismos conforme a las finalidades aquí descritas.`}
          </p>
        </section>

        {/* Inquiries and Contact */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
            {isEn ? 'Procedure for Inquiries and Claims' : 'Procedimiento para consultas y reclamos'}
          </h3>
          <p className="mb-6">
            {isEn 
              ? 'To exercise their rights, the owner may send their request to the email below. Inquiries and claims will be addressed within the terms established by law.'
              : 'Para ejercer sus derechos, el titular podrá enviar su solicitud al correo electrónico a continuación. Las consultas y reclamos serán atendidos en los términos establecidos por la ley.'}
          </p>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <h4 className="font-bold text-slate-900">{isEn ? 'Contact Information:' : 'Datos de contacto:'}</h4>
            <div className="flex flex-col gap-2 text-slate-600">
              <div className="flex gap-2">
                <span className="font-bold">{isEn ? 'Email:' : 'Correo:'}</span>
                <a href="mailto:lidermarketingonline@espaciosimportados.com.co" className="text-brand-600 hover:underline">
                  lidermarketingonline@espaciosimportados.com.co
                </a>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">{isEn ? 'Address:' : 'Dirección:'}</span>
                <span>Centro Comercial IDEO, Local 274</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold">{isEn ? 'City:' : 'Ciudad:'}</span>
                <span>Medellín, Antioquia</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Validity */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
              {isEn ? 'Information Security' : 'Seguridad de la información'}
            </h3>
            <p>
              {isEn 
                ? `${brand} recognizes information as a fundamental asset and is committed to implementing the necessary technical, human, and administrative measures to guarantee the security of personal data, preventing its adulteration, loss, consultation, use, or unauthorized access.`
                : `${brand} reconoce la información como un activo fundamental y se compromete a implementar medidas técnicas, humanas y administrativas necesarias para garantizar la seguridad de los datos personales, evitando su adulteración, pérdida, consulta, uso o acceso no autorizado.`}
            </p>
          </div>
          
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-lg font-black text-brand-900 mb-3 uppercase tracking-wider">
              {isEn ? 'Validity' : 'Vigencia'}
            </h3>
            <p>
              {isEn 
                ? 'This policy takes effect from its publication and will remain in force as long as the purpose of the data processing is maintained.'
                : 'La presente política rige a partir de su publicación y estará vigente mientras se mantenga la finalidad del tratamiento de los datos.'}
            </p>
          </div>
        </section>

        {/* Signature */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-slate-500 mb-4">{isEn ? 'Sincerely,' : 'Atentamente,'}</p>
          <p className="font-black text-lg text-brand-900">ADRIANA RESTREPO</p>
          <p className="text-slate-600 font-medium">{isEn ? 'General Manager' : 'Gerente General'}</p>
          <p className="text-brand-600 font-bold">{brand}</p>
          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
            {isEn ? 'Prepared by:' : 'Elaborado por:'} Marta Nancy Mesa
          </div>
        </section>

      </div>
    </div>
  );
};

export default PrivacyTab;
