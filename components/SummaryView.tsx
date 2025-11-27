
import React, { useState, useRef, useEffect } from 'react';
import { SummaryData, Meeting, VideoClip } from '../types';
import { jsPDF } from 'jspdf';

interface SummaryViewProps {
  summary: SummaryData;
  meeting: Meeting;
  videoBlob: Blob | null;
  onClose: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ summary, meeting, videoBlob, onClose }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript' | 'email' | 'highlights'>('notes');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Highlight / Clip State
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [newClipStart, setNewClipStart] = useState<number | null>(null);
  const [newClipEnd, setNewClipEnd] = useState<number | null>(null);
  const [newClipLabel, setNewClipLabel] = useState('');
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoBlob]);

  // Monitor video time to stop playback if we are playing a specific clip
  const handleTimeUpdate = () => {
    if (!videoRef.current || !playingClipId) return;

    const activeClip = clips.find(c => c.id === playingClipId);
    if (activeClip && videoRef.current.currentTime >= activeClip.end) {
      videoRef.current.pause();
      setPlayingClipId(null);
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      setPlayingClipId(null); // Cancel clip mode if manually jumping
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const playClip = (clip: VideoClip) => {
    if (videoRef.current) {
      setPlayingClipId(clip.id);
      videoRef.current.currentTime = clip.start;
      videoRef.current.play();
    }
  };

  const captureStart = () => {
    if (videoRef.current) {
      setNewClipStart(videoRef.current.currentTime);
      // Reset end if it's before start
      if (newClipEnd !== null && newClipEnd < videoRef.current.currentTime) {
        setNewClipEnd(null);
      }
    }
  };

  const captureEnd = () => {
    if (videoRef.current) {
      setNewClipEnd(videoRef.current.currentTime);
    }
  };

  const saveClip = () => {
    if (newClipStart !== null && newClipEnd !== null && newClipLabel.trim()) {
      const clip: VideoClip = {
        id: Date.now().toString(),
        label: newClipLabel,
        start: newClipStart,
        end: newClipEnd
      };
      setClips([...clips, clip]);
      // Reset form
      setNewClipStart(null);
      setNewClipEnd(null);
      setNewClipLabel('');
    }
  };

  const deleteClip = (id: string) => {
    setClips(clips.filter(c => c.id !== id));
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-400 bg-green-900/20 border-green-800';
      case 'tense': return 'text-red-400 bg-red-900/20 border-red-800';
      case 'energetic': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      default: return 'text-blue-400 bg-blue-900/20 border-blue-800';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = 20;

    // --- Helper Functions ---
    const checkPageBreak = (heightNeeded: number) => {
      if (yPos + heightNeeded > pageHeight - margin) {
        doc.addPage();
        yPos = 30; // Reset yPos for new page
      }
    };

    const addSectionHeader = (title: string, color: [number, number, number]) => {
      checkPageBreak(25);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(title.toUpperCase(), margin, yPos);
      
      // Decorative Underline
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos + 2, margin + 60, yPos + 2);
      
      yPos += 15;
    };

    const addBodyText = (text: string) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85); // Slate-700
      
      const lines = doc.splitTextToSize(text || "N/A", pageWidth - (margin * 2));
      checkPageBreak(lines.length * 6);
      doc.text(lines, margin, yPos);
      yPos += (lines.length * 6) + 10;
    };

    const addBulletPoints = (items: string[]) => {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);

      items.forEach(item => {
        const bullet = "•";
        const indent = 5;
        const textLines = doc.splitTextToSize(item, pageWidth - (margin * 2) - indent);
        checkPageBreak(textLines.length * 6);
        doc.text(bullet, margin, yPos);
        doc.text(textLines, margin + indent, yPos);
        yPos += (textLines.length * 6) + 4;
      });
      yPos += 5;
    };

    // --- Document Generation ---

    // 1. Header Background (Blue Brand Color)
    doc.setFillColor(59, 130, 246); // #3b82f6
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // 2. Title & Date
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Meeting Report", margin, 25);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(meeting.title, margin, 35);

    yPos = 60;

    // 3. Metadata Box
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.rect(margin, yPos, pageWidth - (margin * 2), 40, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    
    // Grid Layout for Metadata
    const col1 = margin + 5;
    const col2 = margin + 90;
    
    doc.text("DATE", col1, yPos + 10);
    doc.text("DURATION", col1, yPos + 25);
    doc.text("PLATFORM", col2, yPos + 10);
    doc.text("SENTIMENT", col2, yPos + 25);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(summary.date, col1 + 25, yPos + 10);
    doc.text(meeting.duration, col1 + 25, yPos + 25);
    doc.text(meeting.platform, col2 + 25, yPos + 10);
    doc.text(summary.sentiment || "Neutral", col2 + 25, yPos + 25);

    yPos += 50;

    // 4. Executive Summary
    addSectionHeader("Executive Summary", [37, 99, 235]); // Blue
    addBodyText(summary.summaryText);

    // 5. Key Points
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      addSectionHeader("Key Points", [37, 99, 235]);
      addBulletPoints(summary.keyPoints);
    }

    // 6. Action Items
    if (summary.actionItems && summary.actionItems.length > 0) {
      addSectionHeader("Action Items", [147, 51, 234]); // Purple
      addBulletPoints(summary.actionItems);
    }
    
    // 7. Video Highlights (Added to PDF)
    if (clips.length > 0) {
        addSectionHeader("Video Highlights", [234, 88, 12]); // Orange
        const clipTexts = clips.map(c => `${c.label} (${formatTime(c.start)} - ${formatTime(c.end)})`);
        addBulletPoints(clipTexts);
    }

    // 8. Footer (Page Numbers)
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text(`NotePilot AI Meeting Report • Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Save File
    const safeTitle = meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`NotePilot_Report_${safeTitle}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 animate-fade-in">
      
      {/* Top Bar: Title & Controls */}
      <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
        <div>
           <h2 className="text-2xl font-bold text-white">{meeting.title}</h2>
           <p className="text-slate-400 text-sm">Recorded on {summary.date}</p>
        </div>
        <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Close</button>
            <button 
              onClick={handleExportPDF}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-900/20 font-medium flex items-center transition-transform hover:scale-105"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export PDF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-grow overflow-hidden">
        
        {/* Left Col: Video Player & Sentiment */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2">
            <div className="bg-black rounded-xl overflow-hidden shadow-xl border border-slate-700 aspect-video group relative">
                {videoUrl ? (
                    <video 
                        ref={videoRef}
                        src={videoUrl} 
                        controls
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full h-full"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">No Video Available</div>
                )}
                
                {playingClipId && (
                   <div className="absolute top-4 left-4 bg-orange-600/90 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg">
                     Playing Highlight
                   </div>
                )}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-4">Meeting Insights</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/30 p-4 rounded-lg">
                        <span className="text-xs text-slate-400 block mb-1">Sentiment</span>
                        <span className={`px-2 py-1 rounded text-sm font-bold border ${getSentimentColor(summary.sentiment)}`}>
                            {summary.sentiment || 'Neutral'}
                        </span>
                    </div>
                    <div className="bg-slate-700/30 p-4 rounded-lg">
                        <span className="text-xs text-slate-400 block mb-1">Attendees</span>
                        <span className="text-white font-bold text-lg">{summary.attendeesDetected?.length || 0}</span>
                    </div>
                </div>
                
                <div className="mt-4">
                     <span className="text-xs text-slate-400 block mb-2">Key Topics</span>
                     <div className="flex flex-wrap gap-2">
                         {summary.keyPoints?.slice(0, 4).map((pt, i) => (
                             <span key={i} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs truncate max-w-full">
                                 {pt.length > 30 ? pt.substring(0,30)+'...' : pt}
                             </span>
                         ))}
                     </div>
                </div>
            </div>
        </div>

        {/* Right Col: Tabs */}
        <div className="lg:col-span-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-700 bg-slate-900/50">
                <button 
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'notes' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    AI Notes
                </button>
                <button 
                    onClick={() => setActiveTab('transcript')}
                    className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'transcript' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    Transcript
                </button>
                <button 
                    onClick={() => setActiveTab('highlights')}
                    className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'highlights' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    Highlights
                </button>
                <button 
                    onClick={() => setActiveTab('email')}
                    className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'email' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    Follow-up
                </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 bg-slate-800">
                {activeTab === 'notes' && (
                    <div className="space-y-8 animate-fade-in">
                        <section>
                            <h3 className="text-lg font-semibold text-blue-400 mb-3">Executive Summary</h3>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-line text-sm">{summary.summaryText}</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-purple-400 mb-3">Action Items</h3>
                            <ul className="space-y-3">
                                {summary.actionItems && summary.actionItems.length > 0 ? (
                                    summary.actionItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                                        <input type="checkbox" className="mt-1 mr-3 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-800" />
                                        <span className="text-slate-200 text-sm">{item}</span>
                                    </li>
                                    ))
                                ) : (
                                    <p className="text-slate-500 italic">No specific action items detected.</p>
                                )}
                            </ul>
                        </section>
                    </div>
                )}

                {activeTab === 'transcript' && (
                    <div className="space-y-2 animate-fade-in">
                        {summary.transcript && summary.transcript.length > 0 ? (
                            summary.transcript.map((seg, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => jumpToTime(seg.timestamp)}
                                    className="group flex gap-4 p-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
                                >
                                    <span className="text-xs text-slate-500 font-mono mt-1 min-w-[3rem] group-hover:text-blue-400">
                                        {formatTime(seg.timestamp)}
                                    </span>
                                    <p className="text-slate-300 text-sm leading-relaxed">{seg.text}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 italic text-center mt-10">No transcript data captured.</p>
                        )}
                    </div>
                )}

                {activeTab === 'highlights' && (
                    <div className="animate-fade-in space-y-6">
                        {/* Creation Tools */}
                        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                            <h3 className="text-sm font-bold text-orange-400 mb-3 uppercase tracking-wide">Create New Highlight</h3>
                            
                            <div className="flex gap-4 mb-3">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-400 block mb-1">Start Time</label>
                                    <button 
                                      onClick={captureStart}
                                      className="w-full text-left bg-slate-800 border border-slate-600 hover:border-blue-500 text-slate-200 px-3 py-2 rounded text-sm transition-colors flex justify-between"
                                    >
                                        <span>{newClipStart !== null ? formatTime(newClipStart) : '--:--'}</span>
                                        <span className="text-blue-400 text-xs font-bold">SET CURRENT</span>
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-slate-400 block mb-1">End Time</label>
                                    <button 
                                      onClick={captureEnd}
                                      className="w-full text-left bg-slate-800 border border-slate-600 hover:border-blue-500 text-slate-200 px-3 py-2 rounded text-sm transition-colors flex justify-between"
                                    >
                                        <span>{newClipEnd !== null ? formatTime(newClipEnd) : '--:--'}</span>
                                        <span className="text-blue-400 text-xs font-bold">SET CURRENT</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <label className="text-xs text-slate-400 block mb-1">Label / Note</label>
                                <input 
                                    type="text" 
                                    value={newClipLabel}
                                    onChange={(e) => setNewClipLabel(e.target.value)}
                                    placeholder="e.g. Budget Discussion"
                                    className="w-full bg-slate-800 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                                />
                            </div>
                            
                            <button 
                                onClick={saveClip}
                                disabled={newClipStart === null || newClipEnd === null || !newClipLabel}
                                className={`w-full py-2 rounded font-bold text-sm shadow-lg transition-colors ${
                                    newClipStart !== null && newClipEnd !== null && newClipLabel
                                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                Save Highlight
                            </button>
                        </div>
                        
                        {/* List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Saved Highlights</h3>
                            {clips.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No highlights created yet.</p>
                            ) : (
                                clips.map(clip => (
                                    <div key={clip.id} className={`bg-slate-700/20 border rounded-lg p-3 flex justify-between items-center ${playingClipId === clip.id ? 'border-orange-500 bg-orange-900/10' : 'border-slate-700'}`}>
                                        <div>
                                            <h4 className={`font-semibold text-sm ${playingClipId === clip.id ? 'text-orange-400' : 'text-slate-200'}`}>{clip.label}</h4>
                                            <p className="text-xs text-slate-500 font-mono mt-1">
                                                {formatTime(clip.start)} - {formatTime(clip.end)} ({Math.round(clip.end - clip.start)}s)
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => playClip(clip)}
                                                className="p-2 bg-slate-800 hover:bg-orange-600 text-slate-300 hover:text-white rounded-full transition-colors"
                                                title="Play Highlight"
                                            >
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </button>
                                            <button 
                                                onClick={() => deleteClip(clip.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'email' && (
                    <div className="animate-fade-in h-full flex flex-col">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap flex-grow shadow-inner">
                            {summary.followUpEmail || "No email draft generated."}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(summary.followUpEmail);
                                    alert('Copied to clipboard!');
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                Copy to Clipboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryView;
