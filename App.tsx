import React, { useState } from 'react';
import Layout from './components/Layout';
import MeetingCard from './components/MeetingCard';
import Recorder from './components/Recorder';
import SummaryView from './components/SummaryView';
import GoogleConnect from './components/GoogleConnect';
import { AppState, Meeting, SummaryData, UserProfile, TranscriptSegment, MeetingHighlight } from './types';
import { UPCOMING_MEETINGS, MOCK_USER_PROFILE } from './constants';
import { generateMeetingSummary } from './services/geminiService';
import { signInWithGoogle, fetchGoogleCalendarEvents } from './services/googleService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.CALENDAR);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  // Auth & Calendar State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>(UPCOMING_MEETINGS);

  const handleGoogleConnect = async (isDemo = false) => {
    setIsGoogleLoading(true);
    setProcessingError(null);
    setGoogleError(null);
    
    if (isDemo) {
      setTimeout(() => {
        setUser(MOCK_USER_PROFILE);
        setMeetings(prev => {
           const existingIds = new Set(prev.map(m => m.id));
           const newEvents = UPCOMING_MEETINGS.filter(e => !existingIds.has(e.id));
           return [...prev, ...newEvents];
        });
        setIsGoogleLoading(false);
      }, 800);
      return;
    }

    try {
      const userProfile = await signInWithGoogle();
      setUser(userProfile);
      
      const calendarEvents = await fetchGoogleCalendarEvents();
      setMeetings(prev => {
         const existingIds = new Set(prev.map(m => m.id));
         const newEvents = calendarEvents.filter(e => !existingIds.has(e.id));
         return [...prev, ...newEvents];
      });
    } catch (error: any) {
      console.error("Failed to connect Google", error);
      
      if (error && error.message === 'GOOGLE_CLIENT_ID_MISSING') {
        setIsGoogleLoading(false);
        return;
      }
      
      // Handle the specific error string patterns
      const errorMessage = error?.message || JSON.stringify(error);
      const isInvalidRequest = error?.type === 'token_failed' || 
                               error?.error === 'invalid_request' || 
                               errorMessage.includes('invalid_request') ||
                               errorMessage.includes('access_denied');

      if (isInvalidRequest) {
         setGoogleError(`Error 400: invalid_request. Preview URL blocked by Google Policy.`);
      } else {
         setGoogleError(errorMessage || "Connection failed.");
         setProcessingError("Could not connect to Google Calendar. Check if popups are blocked.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleJoin = (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setState(AppState.RECORDING);
  };

  const handleStopRecording = async (
    audioVideoBlob: Blob, 
    videoBlob: Blob | null,
    transcript: TranscriptSegment[],
    highlights: MeetingHighlight[]
  ) => {
    setState(AppState.PROCESSING);
    setRecordedVideoBlob(videoBlob);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioVideoBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const cleanBase64 = base64data.split(',')[1];
        
        try {
          const result = await generateMeetingSummary(
            cleanBase64, 
            `Meeting Title: ${activeMeeting?.title}. Attendees: ${activeMeeting?.attendees.map(a => a.name).join(', ')}`,
            transcript,
            highlights
          );
          
          setSummaryData({
            meetingTitle: activeMeeting?.title || 'Unknown Meeting',
            date: new Date().toLocaleDateString(),
            summaryText: result.summaryText || "No summary generated.",
            actionItems: result.actionItems || [],
            keyPoints: result.keyPoints || [],
            attendeesDetected: result.attendeesDetected || [],
            sentiment: result.sentiment || 'Neutral',
            followUpEmail: result.followUpEmail || '',
            transcript: result.transcript || []
          });
          
          setState(AppState.SUMMARY);
        } catch (apiError) {
          console.error(apiError);
          setProcessingError("Failed to generate summary with Gemini. Please try again.");
          setState(AppState.CALENDAR);
        }
      };
    } catch (err) {
      console.error(err);
      setProcessingError("Failed to process recording file.");
      setState(AppState.CALENDAR);
    }
  };

  const resetApp = () => {
    setState(AppState.CALENDAR);
    setActiveMeeting(null);
    setSummaryData(null);
    setRecordedVideoBlob(null);
    setProcessingError(null);
  };

  return (
    <Layout user={user}>
      {state === AppState.CALENDAR && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Upcoming Meetings</h2>
              <p className="text-slate-400">Select a meeting to join and activate the AI recorder.</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-2xl font-light text-white">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              <p className="text-blue-400 text-sm font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          
          <GoogleConnect 
            isConnected={!!user} 
            user={user} 
            isLoading={isGoogleLoading} 
            error={googleError}
            onConnect={handleGoogleConnect} 
          />
          
          {processingError && (
             <div className="mb-6 bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-center">
               <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               {processingError}
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} onJoin={handleJoin} />
            ))}
            
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors cursor-pointer min-h-[200px]">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="font-medium">Add Manual Meeting</span>
            </div>
          </div>
        </div>
      )}

      {state === AppState.RECORDING && activeMeeting && (
        <Recorder 
          meeting={activeMeeting} 
          onStop={handleStopRecording} 
          onCancel={resetApp}
        />
      )}

      {state === AppState.PROCESSING && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-pulse">
           <div className="relative w-24 h-24">
             <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
             </div>
           </div>
           <div>
             <h2 className="text-2xl font-bold text-white">Processing Meeting Data</h2>
             <p className="text-slate-400 mt-2">Uploading audio & transcript to Gemini 2.5...</p>
             <p className="text-slate-500 text-sm mt-1">Generating summary, sentiment analysis, and action items.</p>
           </div>
        </div>
      )}

      {state === AppState.SUMMARY && summaryData && activeMeeting && (
        <SummaryView 
          summary={summaryData} 
          meeting={activeMeeting} 
          videoBlob={recordedVideoBlob}
          onClose={resetApp} 
        />
      )}
    </Layout>
  );
};

export default App;