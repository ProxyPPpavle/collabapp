
export type Plan = 'free' | 'pro' | 'premium';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  plan: Plan;
  friends: string[]; // User IDs
  lastSeen?: number; // Timestamp for online status
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromUsername: string;
  toId: string;
  timestamp: number;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  fromUsername: string;
  toId: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: string[]; // User IDs
  createdAt: number;
}

export interface Message {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'file';
  file?: SharedFile;
  timestamp: number;
  expiresAt: number;
}

export interface SharedFile {
  name: string;
  size: number;
  type: string;
  url: string; 
}
