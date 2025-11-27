import React, { useEffect, useRef, useState } from 'react';
import { Meeting, TranscriptSegment, MeetingHighlight } from '../types';

interface RecorderProps {
  meeting: Meeting;
  onStop: (audioBlob: Blob, videoBlob: Blob | null, transcript: TranscriptSegment[], highlights: MeetingHighlight[]) => void;
  onCancel: () => void;
}

const Recorder: React.FC<RecorderProps> = ({ meeting, onStop, onCancel }) => {
  const [status, setStatus] = useState<'IDLE' | 'RECORDING' | 'PAUSED'>('IDLE');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time features
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [highlights, setHighlights] = useState<MeetingHighlight[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null); // SpeechRecognition

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript, currentText]);

  // Initialize recording when component mounts
  useEffect(() => {
    startCapture();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCapture = async () => {
    try {
      setError(null);
      
      // 1. Open the meeting URL in a new tab
      window.open(meeting.url, '_blank');

      // 2. Request System Audio & Video (Screen Share)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // 3. Request Microphone Audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // 4. Mix Audio Streams
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      
      if (displayStream.getAudioTracks().length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(displayStream);
        sysSource.connect(dest);
      } else {
        // Not a blocking error, but good to know
        console.warn("No system audio detected.");
      }

      if (micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
      }

      // 5. Create Final Stream
      const mixedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);
      streamRef.current = mixedStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mixedStream;
      }

      // 6. Setup Visualizer
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; 
      const source = audioCtx.createMediaStreamSource(dest.stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      visualize();

      // 7. Initialize Speech Recognition (Web Speech API)
      initSpeechRecognition();

      // 8. Handle Stream Stop
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      // 9. Start Recording
      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const fullBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        // Stop recognition
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        onStop(fullBlob, fullBlob, transcript, highlights); 
      };

      mediaRecorder.start(1000); 
      mediaRecorderRef.current = mediaRecorder;
      setStatus('RECORDING');

      intervalRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error starting capture:", err);
      setError("Failed to access screen or microphone. Please allow permissions.");
      if ((err as Error).name === 'NotAllowedError') {
        onCancel();
      }
    }
  };

  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn("Web Speech API not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => [...prev, {
          timestamp: duration, // Use current recording duration
          text: final,
          isFinal: true
        }]);
        setCurrentText('');
      } else {
        setCurrentText(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
    };
    
    // Auto-restart if it stops unexpectedly
    recognition.onend = () => {
        if (status === 'RECORDING') {
            try {
                recognition.start();
            } catch (e) {
                // Ignore if already started
            }
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  };

  const cleanup = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  };

  const addHighlight = () => {
    const timestamp = duration;
    setHighlights(prev => [...prev, { timestamp, label: 'Important' }]);
  };

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#3b82f6'); 
      gradient.addColorStop(0.5, '#8b5cf6'); 
      gradient.addColorStop(1, '#3b82f6'); 
      ctx.strokeStyle = gradient;
      
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#60a5fa'; 

      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in gap-6">
      {/* Header */}
      <div className="flex justify-between items-center px-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            {meeting.title}
          </h2>
          <p className="text-slate-400 text-sm mt-1">NotePilot AI is listening and recording...</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 font-mono text-blue-400">
            {formatTime(duration)}
          </div>
          <button
            onClick={handleStopRecording}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-red-900/30 transition-all hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
            <span>End & Summarize</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow overflow-hidden">
        
        {/* Left: Video Preview & Visualizer */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="relative flex-grow bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700 group">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-contain"
            />
            {/* Waveform Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
              <canvas 
                ref={canvasRef} 
                width={1024} 
                height={200}
                className="w-full h-full opacity-80"
              />
            </div>

            {/* Hover Controls */}
             <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={addHighlight}
                  className="bg-yellow-500/90 hover:bg-yellow-400 text-black px-4 py-2 rounded-full font-bold flex items-center shadow-lg transform active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Mark Important
                </button>
             </div>
             
             {/* Highlight Toast */}
             {highlights.length > 0 && highlights[highlights.length - 1].timestamp > duration - 2 && (
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500/90 text-black px-6 py-3 rounded-full font-bold shadow-xl animate-bounce">
                 Marker Added!
               </div>
             )}
          </div>
          
          {error && <div className="bg-red-900/30 border border-red-500/30 p-3 rounded text-red-200 text-sm text-center">{error}</div>}
        </div>

        {/* Right: Live Transcript */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur">
            <h3 className="text-white font-bold flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              Live Transcript
            </h3>
          </div>
          
          <div ref={transcriptRef} className="flex-grow overflow-y-auto p-4 space-y-4 scroll-smooth">
            {transcript.length === 0 && !currentText && (
              <div className="text-slate-500 text-center mt-10 italic">
                Listening for speech...<br/>
                <span className="text-xs text-slate-600">Captions will appear here in real-time.</span>
              </div>
            )}
            
            {transcript.map((seg, idx) => (
              <div key={idx} className="flex gap-3 animate-fade-in">
                <span className="text-xs text-slate-500 font-mono mt-1 min-w-[3rem]">{formatTime(seg.timestamp)}</span>
                <p className="text-slate-200 text-sm leading-relaxed">{seg.text}</p>
              </div>
            ))}
            
            {currentText && (
              <div className="flex gap-3 opacity-70">
                <span className="text-xs text-slate-500 font-mono mt-1 min-w-[3rem]">{formatTime(duration)}</span>
                <p className="text-slate-400 text-sm italic leading-relaxed">{currentText}...</p>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-slate-900/30 border-t border-slate-700 text-xs text-center text-slate-500">
            Powered by Web Speech API
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recorder;