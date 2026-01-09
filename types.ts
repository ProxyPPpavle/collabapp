
export type Plan = 'free' | 'pro' | 'premium';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  plan: Plan;
  friends: string[]; // User IDs
  friendRequests: FriendRequest[];
}

export interface FriendRequest {
  fromId: string;
  fromUsername: string;
  timestamp: number;
}

export interface Group {
  id: string;
  name: string;
  members: string[]; // User IDs
  createdAt: number;
  lastMessage?: string;
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
}

export interface SharedFile {
  name: string;
  size: number;
  type: string;
  url: string; // Object URL for preview/download
  expiryTimer?: number;
}

export interface AppState {
  currentUser: User | null;
  groups: Group[];
  activeGroupId: string | null;
  messages: Record<string, Message[]>; // Group ID -> Messages
  allUsers: User[]; // Mock database
}
