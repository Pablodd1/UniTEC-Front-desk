import React, { useState } from 'react';
import { Calendar as CalendarIcon, Mail, Plus, Clock, Video, User } from 'lucide-react';
import { CalendarEvent } from '../types';

const MOCK_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Wholesale Quote - Miami Hotel', start: new Date(new Date().setHours(10, 0)), end: new Date(new Date().setHours(11, 0)), attendees: ['john@hotel.com'], status: 'confirmed' },
  { id: '2', title: 'WPC Panel Install Consult', start: new Date(new Date().setHours(14, 0)), end: new Date(new Date().setHours(14, 30)), attendees: ['sarah@design.co'], status: 'pending' },
  { id: '3', title: 'Monthly Inventory Review', start: new Date(new Date().setHours(16, 0)), end: new Date(new Date().setHours(17, 0)), attendees: ['internal'], status: 'confirmed' },
];

const CalendarTab: React.FC = () => {
  const [events] = useState<CalendarEvent[]>(MOCK_EVENTS);
  const [selectedView, setSelectedView] = useState<'calendar' | 'email'>('calendar');

  return (
    <div className="p-6 h-full flex flex-col">
       <div className="flex items-center justify-between mb-6">
          <div className="flex bg-gray-200 rounded-lg p-1">
             <button 
                onClick={() => setSelectedView('calendar')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${selectedView === 'calendar' ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:text-gray-800'}`}
             >
                <div className="flex items-center gap-2"><CalendarIcon size={16}/> Calendar</div>
             </button>
             <button 
                onClick={() => setSelectedView('email')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${selectedView === 'email' ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:text-gray-800'}`}
             >
                <div className="flex items-center gap-2"><Mail size={16}/> Email Inquiries</div>
             </button>
          </div>
          <button className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-brand-700">
             <Plus size={16} /> New Event
          </button>
       </div>

       {selectedView === 'calendar' ? (
          <div className="flex-1 flex gap-6 overflow-hidden">
             {/* Simple Day View */}
             <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Today's Schedule</h3>
                    <span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Time slots */}
                    {[9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => {
                        const event = events.find(e => e.start.getHours() === hour);
                        return (
                            <div key={hour} className="flex gap-4 group">
                                <div className="w-16 text-right text-xs font-medium text-gray-400 pt-2">
                                    {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                                </div>
                                <div className="flex-1 border-t border-gray-100 relative min-h-[80px]">
                                    {event ? (
                                        <div className={`absolute inset-x-0 top-0 mx-2 p-3 rounded-lg border-l-4 text-sm shadow-sm ${
                                            event.status === 'confirmed' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-amber-50 border-amber-500 text-amber-800'
                                        }`}>
                                            <div className="font-bold flex justify-between">
                                                {event.title}
                                                <span className="text-xs uppercase px-2 py-0.5 bg-white/50 rounded">{event.status}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-xs opacity-80">
                                                <span className="flex items-center gap-1"><Clock size={12}/> 1h</span>
                                                <span className="flex items-center gap-1"><User size={12}/> {event.attendees[0]}</span>
                                                {event.status === 'confirmed' && <span className="flex items-center gap-1"><Video size={12}/> Google Meet</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full hover:bg-gray-50 transition-colors -mt-[1px]"></div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
             
             {/* Integration Status Sidebar */}
             <div className="w-80 flex flex-col gap-4">
                 <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                     <h4 className="font-bold text-sm text-gray-700 mb-4">Integrations Active</h4>
                     <div className="space-y-3">
                         <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-100">
                             <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-6 h-6" alt="GCal" />
                             <div>
                                 <p className="text-sm font-bold text-gray-800">Google Calendar</p>
                                 <p className="text-xs text-green-600">Synced • 2-way</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                             <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" className="w-6 h-6" alt="Gmail" />
                             <div>
                                 <p className="text-sm font-bold text-gray-800">Gmail API</p>
                                 <p className="text-xs text-blue-600">Connected</p>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
          </div>
       ) : (
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Mail size={32} className="text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Email Inquiry Inbox</h3>
              <p className="text-gray-500 max-w-md mt-2">
                  Connect your Google Workspace account to automatically view and reply to appointment requests directly from this dashboard.
              </p>
              <button className="mt-6 bg-white border border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Connect Google Workspace
              </button>
          </div>
       )}
    </div>
  );
};

export default CalendarTab;
