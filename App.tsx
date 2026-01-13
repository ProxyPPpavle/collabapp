
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Group, Message, SharedFile, Reaction } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, CHAT_COLORS, getContrastColor, EMOJIS } from './constants';
import { getFeedbackOnMessage } from './services/gemini';

// --- Real-Time Relay Service (ntfy.sh) ---
// Koristimo javni relay za komunikaciju između uređaja bez sopstvenog backenda
const RELAY_BASE = 'https://ntfy.sh/cl_lab_';

const pushToRelay = async (topic: string, data: any) => {
  try {
    await fetch(`${RELAY_BASE}${topic.toUpperCase()}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) { console.error("Relay Push Error", e); }
};

// --- LabDB (IndexedDB Service) ---
const DB_NAME = 'LabDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storeBlob = async (key: string, blob: Blob) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(blob, key);
  return new Promise((res) => (tx.oncomplete = () => res(true)));
};

const getBlob = async (key: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((res) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
    request.onsuccess = () => res(request.result || null);
    request.onerror = () => res(null);
  });
};

// --- Storage Utils ---
const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new StorageEvent('storage', { key }));
};

const getFromStorage = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const cleanupExpiredMessages = () => {
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cl_msgs_')) {
      const messages = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = messages.filter((m: Message) => (now - m.timestamp) < EXPIRY_DURATION);
      if (filtered.length !== messages.length) {
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  }
};

const safeClearUrl = () => {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has('room')) { url.searchParams.delete('room'); changed = true; }
    if (url.searchParams.has('gdata')) { url.searchParams.delete('gdata'); changed = true; }
    if (changed) window.history.replaceState({}, '', url.pathname);
  } catch (e) {}
};

// --- Auth Page Component ---

const AuthPage: React.FC<{ onAuth: (user: User, autoGroupId?: string) => void }> = ({ onAuth }) => {
  const params = new URLSearchParams(window.location.search);
  const roomToJoin = params.get('room');
  const gdata = params.get('gdata');
  
  const [mode, setMode] = useState<'entry' | 'login' | 'signup' | 'guest' | 'join-link' | 'join-code'>( (roomToJoin || gdata) ? 'join-link' : 'entry');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(CHAT_COLORS[0]);
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users: User[] = getFromStorage('cl_users') || [];
    
    if (gdata) {
      try {
        const decoded = JSON.parse(atob(gdata));
        const allGroups = getFromStorage('cl_groups') || [];
        if (!allGroups.find((g: any) => g.id === decoded.id)) {
           decoded.id = decoded.id.toUpperCase();
           allGroups.push(decoded);
           saveToStorage('cl_groups', allGroups);
        }
      } catch (err) { console.error("Failed to import group", err); }
    }

    if (mode === 'guest' || mode === 'join-link' || mode === 'join-code') {
      const guest: User = {
        id: 'gst_' + Math.random().toString(36).substring(2, 9),
        username: username || 'Guest',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || Math.random()}`,
        plan: 'guest',
        friends: [],
        chatColor: color,
        isGuest: true
      };
      
      let targetRoomId;
      if (mode === 'guest') {
        targetRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newG: Group = { id: targetRoomId, name: `${guest.username}'s Lab`, ownerId: guest.id, members: [guest.id], createdAt: Date.now(), inCall: [] };
        const all = getFromStorage('cl_groups') || [];
        saveToStorage('cl_groups', [...all, newG]);
      } else if (mode === 'join-link') {
        targetRoomId = (roomToJoin || '').toUpperCase();
        if (!targetRoomId && gdata) {
           try { targetRoomId = JSON.parse(atob(gdata)).id.toUpperCase(); } catch(e) {}
        }
      } else {
        targetRoomId = roomCode.toUpperCase();
      }
      onAuth(guest, targetRoomId);
      return;
    }

    if (mode === 'login') {
      const user = users.find((u) => u.email === email || u.username === email);
      if (user) onAuth(user, roomToJoin?.toUpperCase() || undefined);
      else alert('User not found');
    } else {
      if (users.some(u => u.username === username)) { alert("Username taken!"); return; }
      const newUser: User = { 
        id: Math.random().toString(36).substring(2, 9), 
        email, 
        username, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, 
        plan: 'free', 
        friends: [], 
        friendRequests: [],
        chatColor: CHAT_COLORS[0] 
      };
      users.push(newUser);
      saveToStorage('cl_users', users);
      onAuth(newUser, roomToJoin?.toUpperCase() || undefined);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-3xl w-full max-w-md shadow-2xl transform animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
          <Icons.Video />
        </div>
        <h1 className="text-3xl font-black text-white italic uppercase mb-2 text-center">Collab Lab</h1>
        <p className="text-slate-500 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold text-center">Cross-Device Workspace</p>
        
        {mode === 'entry' ? (
          <div className="space-y-3">
              <button onClick={() => setMode('guest')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all">Create Fast Group</button>
              <button onClick={() => setMode('join-code')} className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Join with Code</button>
              <div className="flex gap-2">
                <button onClick={() => setMode('login')} className="flex-1 bg-white/5 border border-white/10 text-indigo-400 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Login</button>
                <button onClick={() => setMode('signup')} className="flex-1 bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Signup</button>
              </div>
          </div>
        ) : (
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'join-code' && <input type="text" placeholder="LAB CODE" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold uppercase text-center tracking-widest" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />}
              {(mode === 'guest' || mode === 'join-link' || mode === 'join-code' || mode === 'signup') && <input type="text" placeholder="YOUR NAME" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold" value={username} onChange={(e) => setUsername(e.target.value)} />}
              {(mode === 'login' || mode === 'signup') && <input type="text" placeholder="EMAIL / USERNAME" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={email} onChange={(e) => setEmail(e.target.value)} />}
              {(mode === 'guest' || mode === 'join-link' || mode === 'join-code') && (
                <div className="flex justify-center gap-2 py-2">
                  {CHAT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-125' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
              {(mode === 'login' || mode === 'signup') && <input type="password" placeholder="PASSWORD" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={password} onChange={(e) => setPassword(e.target.value)} />}
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 shadow-xl shadow-indigo-600/20">Confirm</button>
            </form>
            <button onClick={() => setMode('entry')} className="w-full mt-6 text-slate-600 text-[10px] uppercase font-black tracking-widest hover:text-white transition-all">Back</button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [toast, setToast] = useState<{ m: string; t: 'ok' | 'err' } | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'ask'>('chat');
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const relayAbortRef = useRef<AbortController | null>(null);

  const showToast = (m: string, t: 'ok' | 'err' = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 3000);
  };

  const isOnline = (u: User | string) => {
    const target = typeof u === 'string' ? allUsers.find(au => au.id === u) : u;
    return target?.lastSeen && (Date.now() - target.lastSeen < 20000);
  };

  const fetchData = () => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    const freshMe = users.find(u => u.id === user.id);
    if (freshMe && JSON.stringify(freshMe) !== JSON.stringify(user)) setUser(freshMe);
    if (!allGroups.some(g => g.id === 'live-space')) {
       allGroups.push({ id: 'live-space', name: 'Live Hub', ownerId: 'system', members: [], createdAt: Date.now() });
       saveToStorage('cl_groups', allGroups);
    }
    setAllUsers(users);
    if (activeGroupId) {
      const msgKey = `cl_msgs_${activeGroupId}`;
      const groupMsgs: Message[] = getFromStorage(msgKey) || [];
      setMessages(groupMsgs);
      setOptimisticMessages(prev => prev.filter(om => !groupMsgs.some(fm => fm.id === om.id)));
      const gIdx = allGroups.findIndex(g => g.id === activeGroupId);
      if (gIdx > -1 && !allGroups[gIdx].members.includes(user.id)) {
        allGroups[gIdx].members.push(user.id);
        saveToStorage('cl_groups', allGroups);
      }
    }
    setGroups(allGroups.filter(g => g.members.includes(user.id) || g.id === 'live-space'));
  };

  // --- Real-Time Sync Setup ---
  useEffect(() => {
    if (!user || !activeGroupId) return;
    
    if (relayAbortRef.current) relayAbortRef.current.abort();
    relayAbortRef.current = new AbortController();

    const startRelayListener = async () => {
      try {
        const response = await fetch(`${RELAY_BASE}${activeGroupId.toUpperCase()}/json`, {
          signal: relayAbortRef.current?.signal
        });
        const reader = response.body?.getReader();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter(l => l.trim());
          
          lines.forEach(line => {
            try {
              const event = JSON.parse(line);
              const data = JSON.parse(event.message);
              
              if (data.type === 'message' && data.senderId !== user.id) {
                const msgKey = `cl_msgs_${activeGroupId}`;
                const all = getFromStorage(msgKey) || [];
                if (!all.some((m: any) => m.id === data.msg.id)) {
                  saveToStorage(msgKey, [...all, data.msg]);
                  fetchData();
                }
              }
              if (data.type === 'join' && data.userId !== user.id) {
                const groups = getFromStorage('cl_groups') || [];
                const gIdx = groups.findIndex((g: any) => g.id === activeGroupId);
                if (gIdx > -1 && !groups[gIdx].members.includes(data.userId)) {
                  groups[gIdx].members.push(data.userId);
                  saveToStorage('cl_groups', groups);
                  fetchData();
                }
              }
            } catch (e) {}
          });
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') {
          setTimeout(startRelayListener, 3000);
        }
      }
    };

    startRelayListener();
    // Signal presence to others
    pushToRelay(activeGroupId, { type: 'join', userId: user.id, username: user.username });

    return () => {
      if (relayAbortRef.current) relayAbortRef.current.abort();
    };
  }, [user?.id, activeGroupId]);

  useEffect(() => {
    cleanupExpiredMessages();
    const interval = setInterval(fetchData, 2000);
    const cleanupInterval = setInterval(cleanupExpiredMessages, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      clearInterval(cleanupInterval);
    };
  }, [user, activeGroupId]);

  useEffect(() => {
    if (!user) return;
    const beat = setInterval(() => {
      const users: User[] = getFromStorage('cl_users') || [];
      const meIdx = users.findIndex(u => u.id === user.id);
      if (meIdx > -1) {
        users[meIdx].lastSeen = Date.now();
        saveToStorage('cl_users', users);
      }
    }, 10000);
    return () => clearInterval(beat);
  }, [user]);

  const activeGroup = useMemo(() => groups.find(g => (g.id === activeGroupId)), [groups, activeGroupId]);
  const isAdmin = useMemo(() => user && activeGroup && activeGroup.ownerId === user.id, [user, activeGroup]);

  const handleAuthSuccess = (u: User, autoGroupId?: string) => {
    const users: User[] = getFromStorage('cl_users') || [];
    if (!users.some(existing => existing.id === u.id)) {
      users.push(u);
      saveToStorage('cl_users', users);
    }
    setUser(u);
    if (autoGroupId) {
      const all: Group[] = getFromStorage('cl_groups') || [];
      const gIdx = all.findIndex((g:any) => g.id.toUpperCase() === autoGroupId.toUpperCase());
      if (gIdx > -1) {
        if (!all[gIdx].members.includes(u.id)) {
          all[gIdx].members.push(u.id);
          saveToStorage('cl_groups', all);
        }
        setActiveGroupId(all[gIdx].id);
        safeClearUrl();
      } else { 
        setActiveGroupId('live-space');
      }
    } else {
      setActiveGroupId('live-space');
    }
  };

  const sendSystemMessage = (groupId: string, text: string) => {
    const msgKey = `cl_msgs_${groupId}`;
    const existing = getFromStorage(msgKey) || [];
    const sysMsg: Message = { id: 'sys_'+Math.random(), groupId, senderId: 'system', senderName: 'SYSTEM', text, type: 'system', timestamp: Date.now(), expiresAt: Date.now() + EXPIRY_DURATION };
    saveToStorage(msgKey, [...existing, sysMsg]);
  };

  const handleSendMessage = async (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = user.isGuest ? PLAN_LIMITS.guest : PLAN_LIMITS[user.plan];
      if (file.size > limit) { showToast("File too big!", 'err'); return; }
      const fileKey = `f_${Math.random().toString(36).substring(7)}`;
      await storeBlob(fileKey, file);
      sharedFile = { name: file.name, size: file.size, type: file.type, url: fileKey };
    }

    const newMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      groupId: activeGroupId,
      senderId: user.id,
      senderName: user.username,
      text: text || '',
      type: file ? 'file' : 'text',
      file: sharedFile,
      timestamp: Date.now(),
      expiresAt: Date.now() + EXPIRY_DURATION,
      color: user.chatColor,
      replyToId: replyingTo?.id,
      reactions: []
    };

    const msgKey = `cl_msgs_${activeGroupId}`;
    const all = getFromStorage(msgKey) || [];
    saveToStorage(msgKey, [...all, newMessage]);
    
    // PUSH TO RELAY (Cross-device sync)
    pushToRelay(activeGroupId, { type: 'message', senderId: user.id, msg: newMessage });

    setOptimisticMessages(prev => [...prev, newMessage]);
    setReplyingTo(null);
  };

  const handleEditMessage = (id: string, newText: string) => {
    const msgKey = `cl_msgs_${activeGroupId}`;
    const all: Message[] = getFromStorage(msgKey) || [];
    const idx = all.findIndex(m => m.id === id);
    if (idx > -1) {
      all[idx].text = newText;
      all[idx].isEdited = true;
      saveToStorage(msgKey, all);
      pushToRelay(activeGroupId, { type: 'edit', msgId: id, newText });
      fetchData();
    }
  };

  const handleAdminAction = (targetId: string, action: 'kick') => {
    if (!user || !activeGroup || activeGroup.ownerId !== user.id) return;
    const all: Group[] = getFromStorage('cl_groups') || [];
    const idx = all.findIndex(g => g.id === activeGroupId);
    if (idx > -1) {
      if (action === 'kick') {
        all[idx].members = all[idx].members.filter(m => m !== targetId);
        sendSystemMessage(activeGroupId, `User removed by Admin.`);
        showToast("Kicked.");
      }
      saveToStorage('cl_groups', all);
      fetchData();
    }
  };

  const handleSocialAction = (targetId: string, action: 'request' | 'accept' | 'deny') => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const meIdx = users.findIndex(u => u.id === user.id);
    const targetIdx = users.findIndex(u => u.id === targetId);
    if (meIdx > -1 && targetIdx > -1) {
      if (action === 'request') {
        const requests = users[targetIdx].friendRequests || [];
        if (!requests.includes(user.id)) {
           users[targetIdx].friendRequests = [...requests, user.id];
           showToast("Request Sent!");
        }
      } else if (action === 'accept') {
        users[meIdx].friendRequests = (users[meIdx].friendRequests || []).filter(id => id !== targetId);
        users[meIdx].friends = [...(users[meIdx].friends || []), targetId];
        users[targetIdx].friends = [...(users[targetIdx].friends || []), user.id];
        showToast("Friend Added!");
      } else if (action === 'deny') {
        users[meIdx].friendRequests = (users[meIdx].friendRequests || []).filter(id => id !== targetId);
      }
      saveToStorage('cl_users', users);
      fetchData();
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || !user) return;
    const gId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newG: Group = { id: gId, name: newGroupName, ownerId: user.id, members: [user.id], createdAt: Date.now(), inCall: [] };
    const all = getFromStorage('cl_groups') || [];
    saveToStorage('cl_groups', [...all, newG]);
    setGroups(prev => [...prev, newG]);
    setActiveGroupId(gId);
    setNewGroupName('');
    showToast("Lab Created!");
  };

  const handleUpdateSelf = (updates: Partial<User>) => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const meIdx = users.findIndex(u => u.id === user.id);
    if (meIdx > -1) {
       users[meIdx] = { ...users[meIdx], ...updates };
       saveToStorage('cl_users', users);
       fetchData();
    }
  };

  const chatMessages = useMemo(() => {
    return [...messages, ...optimisticMessages].filter(m => m.type !== 'file');
  }, [messages, optimisticMessages]);

  const labAssets = useMemo(() => {
    return messages.filter(m => m.type === 'file');
  }, [messages]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  useEffect(() => {
    if (activeTab === 'ask' && activeGroupId && !aiFeedback && !isAnalyzing) {
      const triggerAnalysis = async () => {
        setIsAnalyzing(true);
        const contextMessages = messages.slice(-10).map(m => `${m.senderName}: ${m.text}`).join('\n');
        if (contextMessages.trim()) {
           const result = await getFeedbackOnMessage(contextMessages, activeGroup?.name || "Workspace");
           setAiFeedback(result);
        } else {
           setAiFeedback("No active discussion to analyze.");
        }
        setIsAnalyzing(false);
      };
      triggerAnalysis();
    }
  }, [activeTab, activeGroupId, messages.length]);

  if (!user) return <AuthPage onAuth={handleAuthSuccess} />;

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden font-sans select-none">
      
      {/* SOCIAL SIDEBAR */}
      <div className="w-[180px] sm:w-[220px] bg-[#0a0a0c] border-r border-white/5 flex flex-col shrink-0 z-40 sidebar-compact">
        <div className="p-4 border-b border-white/5 flex items-center justify-between h-14">
           {!user.isGuest && (
             <button onClick={() => setShowInbox(true)} className="p-2 bg-white/5 text-slate-500 rounded-xl hover:bg-indigo-600 hover:text-white transition-all relative">
                <Icons.Mail />
                {(user.friendRequests || []).length > 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
             </button>
           )}
           <span className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400 italic mobile-hide">PARTNERS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-4">
           {!user.isGuest && (
             <div className="space-y-2 mobile-hide">
                <div className="flex gap-1">
                   <input 
                    type="text" 
                    placeholder="USERNAME..." 
                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[8px] outline-none focus:border-indigo-500 uppercase font-bold text-white italic" 
                    value={friendSearch} 
                    onChange={e => setFriendSearch(e.target.value)}
                  />
                  <button 
                    onClick={() => {
                      const target = allUsers.find(u => u.username.toLowerCase() === friendSearch.toLowerCase() && !u.isGuest);
                      if (target) { handleSocialAction(target.id, 'request'); setFriendSearch(''); }
                      else showToast("User Not Found", "err");
                    }}
                    className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all"
                  ><Icons.Plus /></button>
                </div>
             </div>
           )}

           <div className="space-y-1">
              {user.friends?.map(fId => {
                const friend = allUsers.find(u => u.id === fId);
                if (!friend) return null;
                return (
                  <div key={fId} onClick={() => setProfileUserId(friend.id)} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
                    <div className="relative shrink-0">
                      <img src={friend.avatar} className="w-7 h-7 rounded-lg bg-black border border-white/5" />
                      {isOnline(friend) && <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0c]"></div>}
                    </div>
                    <p className="flex-1 text-[9px] font-black uppercase text-slate-400 group-hover:text-white truncate italic mobile-hide">{friend.username}</p>
                  </div>
                );
              })}
           </div>
        </div>

        <div className="p-3 border-t border-white/5 bg-black/20">
           <button onClick={() => setProfileUserId(user.id)} className="flex items-center gap-3 group w-full text-left">
             <img src={user.avatar} className="w-8 h-8 rounded-xl border border-white/10" />
             <div className="flex-1 min-w-0 mobile-hide">
                <p className="text-[9px] font-black text-white truncate uppercase italic">{user.username}</p>
                <p className="text-[6px] font-black text-indigo-500 uppercase">PROFILE</p>
             </div>
             <button onClick={(e) => { e.stopPropagation(); window.location.reload(); }} className="text-slate-600 hover:text-rose-500 mobile-hide"><Icons.LogOut /></button>
           </button>
        </div>
      </div>

      {/* WORKSPACE SIDEBAR */}
      <div className="w-[180px] sm:w-[200px] bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl mobile-hide">
        <div className="p-4 border-b border-white/5 h-14 flex items-center">
          <span className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400 italic">PROJECTS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scroll">
          <div className="flex gap-1.5 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-1 pr-2">
            <input 
              type="text" 
              placeholder="NEW..." 
              className="flex-1 bg-transparent px-2 py-1.5 text-[9px] outline-none text-white font-bold uppercase italic"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
            />
            <button onClick={handleCreateGroup} className="p-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all"><Icons.Plus /></button>
          </div>

          <button onClick={() => setActiveGroupId('live-space')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${activeGroupId === 'live-space' ? 'bg-indigo-600 text-white border-indigo-500' : 'hover:bg-white/5 border-transparent opacity-60'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-black uppercase tracking-widest italic">Live Hub</span>
          </button>

          {groups.filter(g => g.id !== 'live-space').map(g => (
            <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all border ${activeGroupId === g.id ? 'bg-[#1a1a20] text-white border-white/10' : 'hover:bg-white/5 border-transparent opacity-80'}`}>
              <div className="w-1 h-1 rounded-full bg-slate-700 opacity-20"></div>
              <span className="text-[9px] font-black truncate uppercase tracking-tighter italic">{g.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col relative bg-[#050505] mobile-full">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10"><Icons.Sparkles /><h2 className="text-sm font-black uppercase tracking-[0.4em] mt-6 italic">Select Workspace</h2></div>
        ) : (
          <>
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0 z-20">
               <div className="flex items-center gap-3 min-w-0">
                  <h2 className="font-black text-[12px] text-white italic uppercase truncate">{activeGroup.name}</h2>
                  {activeGroupId !== 'live-space' && (
                    <button onClick={() => {
                      const gdata = btoa(JSON.stringify({ id: activeGroup.id, name: activeGroup.name, ownerId: activeGroup.ownerId, members: activeGroup.members, createdAt: activeGroup.createdAt }));
                      const link = `${window.location.origin}${window.location.pathname}?room=${activeGroup.id}&gdata=${gdata}`;
                      navigator.clipboard.writeText(link);
                      showToast("Invite Sent to Clipboard!");
                    }} className="px-2 py-1 bg-white/5 text-slate-400 hover:text-white rounded-lg text-[7px] font-black uppercase border border-white/5">Invite</button>
                  )}
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
                    <button onClick={() => setActiveTab('chat')} className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Terminal</button>
                    <button onClick={() => setActiveTab('ask')} className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${activeTab === 'ask' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Insights</button>
                  </div>
                  <button onClick={() => setShowAbout(true)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/5"><Icons.Users /></button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col relative">
                {activeTab === 'chat' ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scroll">
                      {chatMessages.map(msg => (
                        msg.type === 'system' ? (
                          <div key={msg.id} className="text-center py-2"><span className="px-3 py-1 rounded-full bg-indigo-500/5 text-[7px] font-black text-indigo-400/40 uppercase tracking-widest italic">{msg.text}</span></div>
                        ) : (
                          <MessageComponent 
                            key={msg.id} 
                            msg={msg} 
                            me={user!} 
                            isAdmin={isAdmin}
                            onAvatarClick={() => setProfileUserId(msg.senderId)}
                            onReply={() => setReplyingTo(msg)} 
                            onEdit={(txt:string) => handleEditMessage(msg.id, txt)}
                            onDelete={() => {
                              const msgKey = `cl_msgs_${activeGroupId}`;
                              const all = getFromStorage(msgKey) || [];
                              saveToStorage(msgKey, all.filter((m:any)=>m.id!==msg.id));
                              fetchData();
                            }} 
                          />
                        )
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    
                    <div className="p-4 border-t border-white/5 bg-[#08080a]/30">
                      <div className="max-w-4xl mx-auto flex flex-col gap-2">
                        {replyingTo && (
                          <div className="bg-indigo-600/10 p-2 rounded-xl flex items-center justify-between border-l-2 border-indigo-600">
                            <span className="font-black uppercase text-indigo-400 text-[8px] pl-2">Replying to {replyingTo.senderName}</span>
                            <button onClick={() => setReplyingTo(null)} className="p-1"><Icons.X /></button>
                          </div>
                        )}
                        <ChatInput onSend={handleSendMessage} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
                    <div className="w-14 h-14 bg-indigo-600/10 text-indigo-500 rounded-3xl flex items-center justify-center mb-6"><Icons.Sparkles /></div>
                    <div className="max-w-xl w-full bg-white/5 border border-white/10 rounded-[30px] p-6 text-left relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                       {isAnalyzing ? <div className="animate-pulse space-y-2"><div className="h-2 bg-white/10 rounded w-3/4"></div><div className="h-2 bg-white/10 rounded w-full"></div></div> : <div className="text-[11px] leading-relaxed text-slate-300 italic whitespace-pre-wrap">{aiFeedback}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* ASSETS PANEL */}
              {activeGroupId !== 'live-space' && (
                <div className="w-[260px] bg-[#0a0a0c] border-l border-white/5 flex flex-col shrink-0 mobile-hide">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">ASSET LAB</span>
                    <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                    <label htmlFor="lab-up" className="p-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-500 transition-all scale-90"><Icons.Plus /></label>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scroll">
                     {labAssets.map(msg => (
                      <FileItem 
                        key={msg.id} 
                        file={msg.file!} 
                        sender={msg.senderName} 
                        canDelete={isAdmin || user.id === msg.senderId}
                        onDelete={() => {
                          const msgKey = `cl_msgs_${activeGroupId}`;
                          const all = getFromStorage(msgKey) || [];
                          saveToStorage(msgKey, all.filter((m:any)=>m.id!==msg.id));
                          fetchData();
                        }}
                        onDownload={async () => {
                          const blob = await getBlob(msg.file!.url);
                          if (blob) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = msg.file!.name; a.click();
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* PROFILE MODAL */}
      {profileUserId && (
        <div className="fixed inset-0 bg-black/95 z-[1100] flex items-center justify-center p-6" onClick={() => setProfileUserId(null)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[40px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
              {(() => {
                const target = allUsers.find(u => u.id === profileUserId) || (profileUserId === user.id ? user : null);
                if (!target) return <p>User missing</p>;
                const isMe = target.id === user.id;
                return (
                  <div className="flex flex-col items-center">
                    <img src={target.avatar} className="w-24 h-24 rounded-3xl border-4 border-[#0f0f12] shadow-2xl mb-4 bg-black" />
                    <h3 className="text-lg font-black uppercase text-white tracking-tighter">{target.username}</h3>
                    <p className="text-slate-500 text-[8px] uppercase font-bold tracking-[0.3em] mb-6">{isMe ? 'IDENTITY' : 'RESEARCH PARTNER'}</p>
                    
                    <div className="w-full space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-center">
                         <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[12px] font-black text-indigo-400">{target.friends?.length || 0}</p>
                            <p className="text-[7px] font-bold text-slate-600 uppercase">Friends</p>
                         </div>
                         <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[12px] font-black text-white">{isOnline(target) ? 'LIVE' : 'IDLE'}</p>
                            <p className="text-[7px] font-bold text-slate-600 uppercase">Status</p>
                         </div>
                      </div>
                      
                      {isMe ? (
                         <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                               <span className="text-[7px] font-black uppercase text-slate-600 block mb-3">Tone</span>
                               <div className="flex justify-center gap-2">
                                 {CHAT_COLORS.map(c => (
                                   <button key={c} onClick={() => handleUpdateSelf({ chatColor: c })} className={`w-6 h-6 rounded-full border-2 ${user.chatColor === c ? 'border-white' : 'border-transparent opacity-40'}`} style={{ backgroundColor: c }} />
                                 ))}
                               </div>
                            </div>
                         </div>
                      ) : !user.friends?.includes(target.id) && (
                         <button onClick={() => handleSocialAction(target.id, 'request')} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[8px]">Request Partner</button>
                      )}
                    </div>
                    <button onClick={() => setProfileUserId(null)} className="w-full py-3 mt-6 bg-white/5 text-slate-500 rounded-2xl font-black uppercase text-[8px]">Dismiss</button>
                  </div>
                );
              })()}
           </div>
        </div>
      )}

      {/* MEMBERS LIST */}
      {showAbout && activeGroup && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <h3 className="font-black text-sm uppercase text-white mb-6">Lab Team</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                {allUsers.filter(u => activeGroup.members.includes(u.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} className="w-7 h-7 rounded-lg" />
                      <span className="text-[9px] font-black uppercase text-white italic">{m.username}</span>
                    </div>
                    {isAdmin && m.id !== user.id && (
                      <button onClick={() => handleAdminAction(m.id, 'kick')} className="text-[7px] font-black text-rose-500 px-2 py-1 bg-rose-500/10 rounded-lg">Remove</button>
                    )}
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* INBOX MODAL */}
      {showInbox && user && (
        <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-6" onClick={() => setShowInbox(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-black text-white italic uppercase mb-6 text-center">Inbound Signals</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scroll">
                 {(user.friendRequests || []).length === 0 ? <p className="text-center opacity-20 text-[9px] uppercase py-10">Empty</p> : user.friendRequests?.map(id => {
                    const req = allUsers.find(au => au.id === id);
                    return req ? (
                      <div key={id} className="bg-white/5 p-3 rounded-2xl flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-white">{req.username}</span>
                         <div className="flex gap-2">
                            <button onClick={() => handleSocialAction(id, 'accept')} className="p-2 bg-indigo-600 text-white rounded-lg"><Icons.Plus /></button>
                            <button onClick={() => handleSocialAction(id, 'deny')} className="p-2 bg-rose-600 text-white rounded-lg"><Icons.X /></button>
                         </div>
                      </div>
                    ) : null;
                 })}
              </div>
           </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000] px-5 py-2.5 rounded-2xl font-black uppercase text-[8px] tracking-[0.2em] shadow-2xl animate-in slide-in-from-bottom-4 ${toast.t === 'err' ? 'bg-rose-600' : 'bg-indigo-600'} text-white`}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

const MessageComponent = ({ msg, me, isAdmin, onAvatarClick, onReply, onDelete, onEdit }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const contrastText = getContrastColor(msg.color);

  return (
    <div className={`flex gap-3 group/msg ${msg.senderId === me.id ? 'flex-row-reverse' : ''}`} onClick={() => setShowMenu(!showMenu)}>
      <img 
        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} 
        className="w-8 h-8 rounded-lg bg-black border border-white/5 cursor-pointer shrink-0" 
        onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
      />
      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] relative ${msg.senderId === me.id ? 'items-end' : 'items-start'}`}>
        <span className="text-[7px] font-black uppercase opacity-20 italic mb-1">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        <div className={`p-2.5 px-4 rounded-2xl text-[11px] leading-snug transition-all shadow-lg ${msg.senderId === me.id ? 'rounded-tr-none' : 'rounded-tl-none border border-white/5'}`} style={{ backgroundColor: msg.color || '#121216', color: contrastText }}>
          {isEditing ? <textarea className="bg-black/20 text-[11px] outline-none" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && onEdit(editText)} /> : msg.text}
        </div>
        
        {showMenu && !isEditing && (
          <div className={`absolute -top-10 flex bg-[#1a1a20] border border-white/10 rounded-xl p-1 shadow-2xl z-50 animate-in zoom-in-95 ${msg.senderId === me.id ? 'right-0' : 'left-0'}`}>
             <button onClick={(e) => { e.stopPropagation(); onReply(); setShowMenu(false); }} className="p-1.5 hover:bg-white/5 rounded text-indigo-400"><Icons.Reply /></button>
             {msg.senderId === me.id && <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1.5 hover:bg-white/5 rounded text-slate-400"><Icons.Edit /></button>}
             {(msg.senderId === me.id || isAdmin) && <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="p-1.5 hover:bg-rose-500/10 rounded text-rose-500"><Icons.Trash /></button>}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInput: React.FC<{ onSend: (t: string) => void }> = ({ onSend }) => {
  const [text, setText] = useState('');
  const handleSend = () => { if(text.trim()) { onSend(text); setText(''); } };
  return (
    <div className="flex items-end gap-2 bg-[#0f0f12] border border-white/5 rounded-2xl p-1.5 focus-within:border-indigo-500/30 transition-all">
      <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="MESSAGE TERMINAL..." className="flex-1 bg-transparent py-2 px-3 text-[12px] outline-none resize-none text-white placeholder:text-slate-800 font-bold uppercase italic" />
      <button onClick={handleSend} disabled={!text.trim()} className={`p-3 rounded-xl transition-all shadow-lg ${text.trim() ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-800'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, canDelete: boolean, onDelete: () => void, onDownload: () => void }> = ({ file, sender, canDelete, onDelete, onDownload }) => {
  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl p-3 shadow-xl group relative border-l-2 border-indigo-600">
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onDownload} className="p-1.5 bg-indigo-600 text-white rounded-lg"><Icons.Download /></button>
        {canDelete && <button onClick={onDelete} className="p-1.5 bg-rose-600 text-white rounded-lg"><Icons.X /></button>}
      </div>
      <div className="flex items-center gap-3">
         <div className="p-2 bg-indigo-600/10 text-indigo-500 rounded-lg"><Icons.File /></div>
         <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-white truncate uppercase italic">{file.name}</p>
            <p className="text-[7px] text-slate-600 uppercase font-bold mt-1">{sender} • {(file.size / 1024 / 1024).toFixed(1)}MB</p>
         </div>
      </div>
    </div>
  );
};
