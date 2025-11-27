import { Meeting, UserProfile, Attendee } from '../types';

// Declare globals for Google Identity Services
declare global {
  interface Window {
    google: any;
  }
}

// Mutable variable to store Client ID (from env or user input)
let clientId = process.env.GOOGLE_CLIENT_ID || '';

// Scopes must be space-separated
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

let tokenClient: any;
let accessToken: string | null = null;

/**
 * Sets the Google Client ID dynamically.
 */
export const setGoogleClientId = (id: string) => {
  clientId = id.trim();
  // Reset token client to force re-initialization with new ID
  tokenClient = null;
};

/**
 * Checks if a Client ID is currently configured.
 */
export const hasGoogleClientId = (): boolean => {
  return !!clientId;
};

/**
 * Initializes the Google Token Client.
 * This must be called after the Google script has loaded.
 */
const initTokenClient = () => {
  if (typeof window.google === 'undefined') {
    throw new Error('Google Identity Services script not loaded');
  }

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID_MISSING');
  }

  // Log origin for debugging 400 invalid_request errors
  console.log('[GoogleAuth] Initializing with Origin:', window.location.origin);

  if (!tokenClient) {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          // This callback is triggered when requestAccessToken completes
          if (tokenResponse && tokenResponse.access_token) {
            accessToken = tokenResponse.access_token;
          }
        },
      });
    } catch (e) {
      console.error("Failed to init token client:", e);
      throw e;
    }
  }
  return tokenClient;
};

/**
 * Initiates the Google Sign-In flow using the Token Model.
 */
export const signInWithGoogle = async (): Promise<UserProfile> => {
  return new Promise((resolve, reject) => {
    try {
      const client = initTokenClient();
      
      // Override the callback to handle this specific sign-in request
      client.callback = async (resp: any) => {
        if (resp.error) {
          console.error("Google Auth Error Response:", resp);
          reject(resp);
          return;
        }
        
        accessToken = resp.access_token;
        
        // Fetch User Profile immediately after successful auth
        try {
          const userInfo = await fetchUserInfo(accessToken!);
          resolve(userInfo);
        } catch (err) {
          reject(err);
        }
      };

      // Request token (triggers popup)
      client.requestAccessToken({});

    } catch (error) {
      console.error("Error initializing Google Auth:", error);
      reject(error);
    }
  });
};

/**
 * Fetches user profile information from Google.
 */
const fetchUserInfo = async (token: string): Promise<UserProfile> => {
  const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();
  return {
    name: data.name,
    email: data.email,
    avatar: data.picture,
  };
};

/**
 * Fetches upcoming events from the user's primary calendar.
 */
export const fetchGoogleCalendarEvents = async (): Promise<Meeting[]> => {
  if (!accessToken) {
    throw new Error('No access token available. User must sign in first.');
  }

  // Calculate timeMin (now) and timeMax (end of day + 7 days)
  const now = new Date();
  const timeMin = now.toISOString();
  
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const timeMax = nextWeek.toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Calendar API Error', errText);
    throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
  }

  const data = await response.json();
  const items = data.items || [];

  // Map Google Calendar events to our Meeting interface
  return items
    .filter((event: any) => event.status !== 'cancelled')
    .map((event: any) => {
      // 1. Determine Platform & URL
      let platform: 'Google Meet' | 'Zoom' | 'Microsoft Teams' = 'Google Meet';
      let meetingUrl = '';

      if (event.hangoutLink) {
        platform = 'Google Meet';
        meetingUrl = event.hangoutLink;
      } else if (event.location && event.location.includes('zoom.us')) {
        platform = 'Zoom';
        meetingUrl = extractUrl(event.location);
      } else if (event.description && event.description.includes('zoom.us')) {
        platform = 'Zoom';
        meetingUrl = extractUrl(event.description);
      } else if (event.location && event.location.includes('teams.microsoft.com')) {
        platform = 'Microsoft Teams';
        meetingUrl = extractUrl(event.location);
      } else if (event.description && event.description.includes('teams.microsoft.com')) {
        platform = 'Microsoft Teams';
        meetingUrl = extractUrl(event.description);
      }

      // If no valid URL found, fallback to location or just '#'
      if (!meetingUrl) meetingUrl = event.location || '#';

      // 2. Format Time & Duration
      const startDate = new Date(event.start.dateTime || event.start.date);
      const endDate = new Date(event.end.dateTime || event.end.date);
      
      const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffMins = Math.round(diffMs / 60000);
      const durationStr = `${diffMins} min`;

      // 3. Map Attendees
      const attendees: Attendee[] = (event.attendees || [])
        .filter((a: any) => !a.resource) // Filter out room resources
        .map((a: any, index: number) => ({
          id: a.email || `att-${index}`,
          name: a.displayName || a.email.split('@')[0],
          email: a.email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(a.displayName || a.email)}&background=random` // Fallback avatar
        }));

      return {
        id: event.id,
        title: event.summary || '(No Title)',
        platform,
        time: timeStr,
        duration: durationStr,
        url: meetingUrl,
        attendees,
        source: 'GOOGLE_CALENDAR'
      };
    });
};

// Helper to extract first URL from text
function extractUrl(text: string): string {
  if (!text) return '';
  const match = text.match(/(https?:\/\/[^\s]+)/);
  return match ? match[0] : '';
}
