import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { hasGoogleClientId, setGoogleClientId } from '../services/googleService';

interface GoogleConnectProps {
  isConnected: boolean;
  user: UserProfile | null;
  isLoading: boolean;
  error?: string | null;
  onConnect: (isDemo?: boolean) => void;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" className="mr-2" xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1, 0, 0, 1, 0, 0)">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.96-2.91l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.63 4.62 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0 7.565 0 3.515 2.7 1.545 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </g>
  </svg>
);

const GoogleConnect: React.FC<GoogleConnectProps> = ({ isConnected, user, isLoading, error, onConnect }) => {
  const [missingClientId, setMissingClientId] = useState(false);
  const [tempClientId, setTempClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    // Check if ID is already available (via env or previous save)
    if (!hasGoogleClientId()) {
      const saved = localStorage.getItem('google_client_id');
      if (saved) {
        setGoogleClientId(saved);
        setTempClientId(saved);
      } else {
        setMissingClientId(true);
      }
    } else {
      setTempClientId(localStorage.getItem('google_client_id') || '');
    }
  }, []);

  const handleSaveClientId = () => {
    if (tempClientId.trim()) {
      setGoogleClientId(tempClientId.trim());
      localStorage.setItem('google_client_id', tempClientId.trim());
      setMissingClientId(false);
      setShowConfig(false);
    }
  };

  const handleEditSettings = () => {
    setMissingClientId(true);
    setShowConfig(true);
  };

  const handleConnectClick = () => {
    if (!hasGoogleClientId()) {
      setMissingClientId(true);
      return;
    }
    onConnect();
  };

  const handleDemoMode = () => {
    onConnect(true);
  };

  const is400Error = error && (error.includes('invalid_request') || error.includes('400') || error.includes('Origin mismatch') || error.includes('blocked'));

  if (isConnected && user) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center shadow-lg mb-6">
        <div className="flex items-center mb-3 sm:mb-0">
          <div className="p-2 bg-white rounded-full mr-4 shadow-sm">
             <GoogleIcon />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center">
              Google Calendar Connected
              <span className="ml-2 w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            </h3>
            <p className="text-sm text-slate-400">Syncing meetings for <span className="text-blue-400">{user.email}</span></p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={handleEditSettings} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Settings</button>
          <div className="h-4 w-px bg-slate-700"></div>
          <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Disconnect</button>
        </div>
      </div>
    );
  }

  // State: Missing Client ID
  if (missingClientId || showConfig) {
    return (
      <div className="bg-slate-800/80 border border-yellow-500/30 rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
           <div className="p-3 bg-yellow-900/20 rounded-lg text-yellow-500">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div className="flex-grow w-full">
             <h3 className="text-lg font-bold text-white mb-1">Setup Google Integration</h3>
             <p className="text-slate-400 text-sm mb-3">
               To sync your calendar, you need a Google Cloud Client ID. 
               <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">
                 Create one here
               </a>.
             </p>
             <div className="flex flex-col sm:flex-row gap-2 mb-4">
               <input 
                 type="text" 
                 placeholder="Enter Google Client ID (apps.googleusercontent.com)" 
                 className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                 value={tempClientId}
                 onChange={(e) => setTempClientId(e.target.value)}
               />
               <button 
                 onClick={handleSaveClientId}
                 className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
               >
                 Save ID
               </button>
             </div>
             
             <div className="flex items-center justify-between border-t border-slate-700/50 pt-3">
               <div className="text-xs text-slate-500">
                 Skip configuration?
               </div>
               <button 
                 onClick={handleDemoMode}
                 className="text-sm text-blue-400 hover:text-blue-300 font-medium"
               >
                 Enable Demo Mode
               </button>
             </div>
           </div>
        </div>
      </div>
    );
  }

  // State: Ready to Connect
  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/30 rounded-xl p-6 mb-6 relative overflow-hidden">
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="mb-4 md:mb-0 max-w-lg">
          <h3 className="text-lg font-bold text-white mb-1">Connect your Calendar</h3>
          <p className="text-slate-400 text-sm">Automatically import your upcoming Google Meet and Zoom calls.</p>
          
          {error && !is400Error && (
             <div className="mt-3 text-red-400 text-xs bg-red-900/20 p-2 rounded border border-red-500/20">
               {error}
             </div>
          )}
        </div>
        <div className="flex flex-col items-end">
            <button
            onClick={handleConnectClick}
            disabled={isLoading}
            className={`flex items-center px-5 py-2.5 bg-white text-gray-800 rounded-lg font-medium shadow-lg hover:bg-gray-50 transition-all ${isLoading ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105'}`}
            >
            {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <>
                <GoogleIcon />
                Sign in with Google
                </>
            )}
            </button>
            <button onClick={handleEditSettings} className="text-xs text-slate-500 hover:text-slate-400 mt-2 underline">
                Configure Client ID
            </button>
        </div>
      </div>
      
      {/* 400 Error Troubleshooting Panel - The FIX for the user's issue */}
      {is400Error && (
        <div className="relative z-20 mt-4 p-4 bg-red-950/80 border border-red-500/50 rounded-lg text-sm text-red-100 backdrop-blur-sm shadow-xl">
            <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <div className="bg-red-500/20 p-2 rounded-full shrink-0">
                       <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                        <h4 className="font-bold text-red-200 text-base">Google Auth Unavailable in Preview</h4>
                        <p className="text-slate-300 mt-1">
                            Google's security policy blocks authentication from this preview URL because it's not a public domain. This is expected behavior in this environment.
                        </p>
                        <div className="mt-2 text-xs font-mono bg-black/30 p-1 rounded text-slate-400 truncate max-w-md">
                            Blocked Origin: {origin}
                        </div>
                    </div>
                </div>
                
                <button 
                  onClick={handleDemoMode}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center transition-all transform hover:scale-[1.02]"
                >
                  <span>Fix: Enable Demo Mode</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                
                <p className="text-center text-xs text-slate-500">
                    Bypasses Google Auth so you can use the recorder and AI summary features immediately.
                </p>
            </div>
        </div>
      )}

      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
};

export default GoogleConnect;