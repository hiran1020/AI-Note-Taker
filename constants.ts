import { Meeting, Attendee, UserProfile } from './types';

export const MOCK_ATTENDEES: Attendee[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.c@techcorp.com', avatar: 'https://picsum.photos/id/64/100/100' },
  { id: '2', name: 'Marcus Rodriguez', email: 'm.rod@techcorp.com', avatar: 'https://picsum.photos/id/91/100/100' },
  { id: '3', name: 'Alex Kim', email: 'alex.k@design.io', avatar: 'https://picsum.photos/id/177/100/100' },
];

export const MOCK_USER_PROFILE: UserProfile = {
  name: 'Demo User',
  email: 'demo.user@example.com',
  avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff'
};

export const UPCOMING_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    title: 'Q3 Product Roadmap Review',
    platform: 'Google Meet',
    time: '10:00 AM',
    duration: '45 min',
    url: 'https://meet.google.com/abc-defg-hij',
    attendees: [MOCK_ATTENDEES[0], MOCK_ATTENDEES[1]],
  },
  {
    id: 'm2',
    title: 'Design Handoff Sync',
    platform: 'Zoom',
    time: '11:30 AM',
    duration: '30 min',
    url: 'https://zoom.us/j/123456789',
    attendees: [MOCK_ATTENDEES[2]],
  },
  {
    id: 'm3',
    title: 'Weekly Engineering Standup',
    platform: 'Google Meet',
    time: '2:00 PM',
    duration: '15 min',
    url: 'https://meet.google.com/xyz-uvwx-yz',
    attendees: [MOCK_ATTENDEES[0], MOCK_ATTENDEES[1], MOCK_ATTENDEES[2]],
  },
];