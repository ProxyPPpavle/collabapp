
export type Plan = 'free' | 'pro' | 'premium' | 'guest';

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar: string;
  plan: Plan;
  friends: string[];
  friendRequests?: string[]; // IDs of users who sent a request
  lastSeen?: number;
  chatColor?: string;
  isGuest?: boolean;
  isSpeaking?: boolean;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  mutedMembers?: string[];
  inCall?: string[];
  createdAt: number;
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'file' | 'system';
  file?: SharedFile;
  timestamp: number;
  expiresAt: number;
  color?: string;
  replyToId?: string;
  reactions?: Reaction[];
  isEdited?: boolean;
}

export interface SharedFile {
  name: string;
  size: number;
  type: string;
  url: string; 
}
