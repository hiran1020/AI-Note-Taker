import React from 'react';
import { Meeting } from '../types';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (meeting: Meeting) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onJoin }) => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300 group shadow-lg flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className="w-full">
          <div className="flex justify-between items-start w-full">
            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold mb-2 ${
              meeting.platform === 'Google Meet' ? 'bg-green-900/30 text-green-400 border border-green-800' :
              meeting.platform === 'Zoom' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' :
              'bg-indigo-900/30 text-indigo-400 border border-indigo-800'
            }`}>
              {meeting.platform}
            </span>
            {meeting.source === 'GOOGLE_CALENDAR' && (
              <span className="text-slate-500" title="Synced from Google Calendar">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"></path>
                </svg>
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
            {meeting.title}
          </h3>
          <p className="text-slate-400 text-sm mt-1 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {meeting.time} &bull; {meeting.duration}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6 flex items-center justify-between">
        <div className="flex -space-x-2">
          {meeting.attendees.slice(0, 3).map((attendee) => (
            <img
              key={attendee.id}
              className="w-8 h-8 rounded-full border-2 border-slate-800"
              src={attendee.avatar}
              alt={attendee.name}
              title={attendee.name}
            />
          ))}
          {meeting.attendees.length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-slate-800 bg-slate-700 flex items-center justify-center text-xs text-slate-300">
              +{meeting.attendees.length - 3}
            </div>
          )}
        </div>

        <button
          onClick={() => onJoin(meeting)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Join
        </button>
      </div>
    </div>
  );
};

export default MeetingCard;