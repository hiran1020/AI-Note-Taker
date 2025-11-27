
export enum AppState {
  CALENDAR = 'CALENDAR',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  SUMMARY = 'SUMMARY',
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Meeting {
  id: string;
  title: string;
  platform: 'Google Meet' | 'Zoom' | 'Microsoft Teams';
  time: string;
  duration: string; // e.g., "30 min"
  url: string;
  attendees: Attendee[];
  source?: 'MANUAL' | 'GOOGLE_CALENDAR';
}

export interface TranscriptSegment {
  timestamp: number; // Seconds from start
  text: string;
  isFinal: boolean;
}

export interface MeetingHighlight {
  timestamp: number;
  label: string;
}

export interface VideoClip {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface SummaryData {
  meetingTitle: string;
  date: string;
  summaryText: string;
  keyPoints: string[];
  actionItems: string[];
  attendeesDetected: string[];
  sentiment: 'Positive' | 'Neutral' | 'Tense' | 'Energetic';
  followUpEmail: string;
  transcript: TranscriptSegment[];
}
