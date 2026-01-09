
export type Plan = 'free' | 'pro' | 'premium';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  plan: Plan;
  friends: string[]; // User IDs
  lastSeen?: number;
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
  mutedMembers?: string[]; // IDs of users who can't speak
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
