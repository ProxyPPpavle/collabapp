
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Group, Message, SharedFile, Reaction } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, CHAT_COLORS, getContrastColor, EMOJIS } from './constants';
// Import the feedback service
import { getFeedbackOnMessage } from './services/gemini';

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

const safeClearUrl = () => {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
    }
  } catch (e) {}
};

// --- Auth Page Component ---

const AuthPage: React.FC<{ onAuth: (user: User, autoGroupId?: string) => void }> = ({ onAuth }) => {
  const params = new URLSearchParams(window.location.search);
  const roomToJoin = params.get('room');
  
  const [mode, setMode] = useState<'entry' | 'login' | 'signup' | 'guest' | 'join-link' | 'join-code'>(roomToJoin ? 'join-link' : 'entry');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(CHAT_COLORS[0]);
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users: User[] = getFromStorage('cl_users') || [];
    
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
        
        {mode === 'entry' ? (
          <div className="text-center">
            <h1 className="text-3xl font-black text-white italic uppercase mb-2">Collab Lab</h1>
            <p className="text-slate-500 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold">Fast Workspace Hub</p>
            <div className="space-y-3">
              <button onClick={() => setMode('guest')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all">Create Fast Group</button>
              <button onClick={() => setMode('join-code')} className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Join with Code</button>
              <div className="flex gap-2">
                <button onClick={() => setMode('login')} className="flex-1 bg-white/5 border border-white/10 text-indigo-400 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Login</button>
                <button onClick={() => setMode('signup')} className="flex-1 bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Signup</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-black text-white italic uppercase mb-6 text-center">
              {mode === 'join-link' || mode === 'join-code' ? 'Join Lab' : mode === 'guest' ? 'Guest Access' : mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'join-code' && <input type="text" placeholder="LAB CODE" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold uppercase text-center tracking-widest" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />}
              {(mode === 'guest' || mode === 'join-link' || mode === 'join-code' || mode === 'signup') && <input type="text" placeholder="YOUR NAME" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold" value={username} onChange={(e) => setUsername(e.target.value)} />}
              {(mode === 'login' || mode === 'signup') && <input type="text" placeholder="EMAIL / USERNAME" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={email} onChange={(e) => setEmail(e.target.value)} />}
              {(mode === 'guest' || mode === 'join-link' || mode === 'join-code') && (
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-3 text-center">Pick Your Chat Color</label>
                  <div className="flex justify-center gap-2">
                    {CHAT_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-125 shadow-lg' : 'border-transparent opacity-50'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
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
  const [lastSentTime, setLastSentTime] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'ask'>('chat');
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string, t: 'ok' | 'err' = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 3000);
  };

  const isOnline = (u: User | string) => {
    const target = typeof u === 'string' ? allUsers.find(au => au.id === u) : u;
    return target?.lastSeen && (Date.now() - target.lastSeen < 15000);
  };

  const fetchData = () => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    
    const freshMe = users.find(u => u.id === user.id);
    if (freshMe && JSON.stringify(freshMe) !== JSON.stringify(user)) {
      setUser(freshMe);
    }

    if (!allGroups.some(g => g.id === 'live-space')) {
       allGroups.push({ id: 'live-space', name: 'Live Hub', ownerId: 'system', members: [], createdAt: Date.now() });
       saveToStorage('cl_groups', allGroups);
    }

    setAllUsers(users);
    setGroups(allGroups.filter(g => g.members.includes(user.id) || g.id === 'live-space'));

    if (activeGroupId) {
      const msgKey = `cl_msgs_${activeGroupId}`;
      const groupMsgs: Message[] = getFromStorage(msgKey) || [];
      setMessages(groupMsgs);
      setOptimisticMessages(prev => prev.filter(om => !groupMsgs.some(fm => fm.id === om.id)));
    }
  };

  useEffect(() => {
    const sync = (e: StorageEvent) => fetchData();
    window.addEventListener('storage', sync);
    const interval = setInterval(fetchData, 1500);
    return () => {
      window.removeEventListener('storage', sync);
      clearInterval(interval);
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
    }, 5000);
    return () => clearInterval(beat);
  }, [user]);

  const activeGroup = useMemo(() => groups.find(g => (g.id === activeGroupId)), [groups, activeGroupId]);
  const usersInCall = useMemo(() => {
    if (!activeGroup || !activeGroup.inCall) return [];
    return allUsers.filter(u => activeGroup.inCall!.includes(u.id));
  }, [activeGroup, allUsers]);

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
          sendSystemMessage(all[gIdx].id, `${u.username} joined.`);
        }
        setActiveGroupId(all[gIdx].id);
        safeClearUrl();
      } else { 
        showToast("Lab not found!", 'err'); 
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

    setOptimisticMessages(prev => [...prev, newMessage]);
    const msgKey = `cl_msgs_${activeGroupId}`;
    const all = getFromStorage(msgKey) || [];
    saveToStorage(msgKey, [...all, newMessage]);
    setReplyingTo(null);
    setLastSentTime(Date.now());
  };

  const handleEditMessage = (id: string, newText: string) => {
    const msgKey = `cl_msgs_${activeGroupId}`;
    const all: Message[] = getFromStorage(msgKey) || [];
    const idx = all.findIndex(m => m.id === id);
    if (idx > -1) {
      all[idx].text = newText;
      all[idx].isEdited = true;
      saveToStorage(msgKey, all);
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
        showToast("Member kicked.");
      }
      saveToStorage('cl_groups', all);
      fetchData();
    }
  };

  const handleCallAction = (action: 'join' | 'leave') => {
    if (!user || !activeGroupId) return;
    const all: Group[] = getFromStorage('cl_groups') || [];
    const idx = all.findIndex(g => g.id === activeGroupId);
    if (idx > -1) {
      const inCall = all[idx].inCall || [];
      if (action === 'join') {
        if (!inCall.includes(user.id)) {
          all[idx].inCall = [...inCall, user.id];
          sendSystemMessage(activeGroupId, `${user.username} joined call.`);
        }
      } else {
        all[idx].inCall = inCall.filter(id => id !== user.id);
        sendSystemMessage(activeGroupId, `${user.username} left call.`);
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

  const handleAddMemberToGroup = (friendId: string) => {
    if (!activeGroup || !user) return;
    const all: Group[] = getFromStorage('cl_groups') || [];
    const idx = all.findIndex(g => g.id === activeGroupId);
    if (idx > -1) {
      if (!all[idx].members.includes(friendId)) {
        all[idx].members.push(friendId);
        saveToStorage('cl_groups', all);
        sendSystemMessage(activeGroup.id, `Member added by ${user.username}.`);
        fetchData();
        showToast("Member Added!");
      } else {
        showToast("Already a member!", "err");
      }
    }
  };

  const handleUpdateSelf = (updates: Partial<User>) => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const meIdx = users.findIndex(u => u.id === user.id);
    if (meIdx > -1) {
       users[meIdx] = { ...users[meIdx], ...updates };
       saveToStorage('cl_users', users);
       fetchData();
       showToast("Updated!");
    }
  };

  const handleSwitchGroup = (id: string) => {
    setActiveGroupId(id);
    setReplyingTo(null);
    setActiveTab('chat');
    setAiFeedback(null);
  };

  const chatMessages = useMemo(() => {
    return [...messages, ...optimisticMessages].filter(m => m.type !== 'file');
  }, [messages, optimisticMessages]);

  const labAssets = useMemo(() => {
    return messages.filter(m => m.type === 'file');
  }, [messages]);

  const onlineCount = useMemo(() => allUsers.filter(u => isOnline(u)).length, [allUsers]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  useEffect(() => {
    if (activeTab === 'ask' && activeGroupId && !aiFeedback && !isAnalyzing) {
      const triggerAnalysis = async () => {
        setIsAnalyzing(true);
        const contextMessages = messages.slice(-10).map(m => `${m.senderName}: ${m.text}`).join('\n');
        if (contextMessages.trim()) {
           const result = await getFeedbackOnMessage(contextMessages, activeGroup?.name || "General Workspace");
           setAiFeedback(result);
        } else {
           setAiFeedback("No message history available for analysis. Start a conversation to get AI insights.");
        }
        setIsAnalyzing(false);
      };
      triggerAnalysis();
    }
  }, [activeTab, activeGroupId, messages.length]);

  const triggerDownload = async (file: SharedFile) => {
    const blob = await getBlob(file.url);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      showToast("File missing", "err");
    }
  };

  if (!user) return <AuthPage onAuth={handleAuthSuccess} />;

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden font-sans select-none">
      
      {/* 1. SOCIAL SIDEBAR (Far Left) */}
      <div className="w-[180px] bg-[#0a0a0c] border-r border-white/5 flex flex-col shrink-0 z-40 sidebar-compact">
        <div className="p-4 border-b border-white/5 flex items-center justify-between h-14">
           {!user.isGuest && (
             <button onClick={() => setShowInbox(true)} className="p-2 bg-white/5 text-slate-500 rounded-xl hover:bg-indigo-600 hover:text-white transition-all relative">
                <Icons.Mail />
                {(user.friendRequests || []).length > 0 && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
             </button>
           )}
           <span className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400 italic mobile-hide">CONTACTS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-4">
           {!user.isGuest && (
             <div className="px-1 mb-2 mobile-hide">
                <input 
                  type="text" 
                  placeholder="SEARCH..." 
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[9px] outline-none focus:border-indigo-500 transition-all uppercase font-bold text-white italic" 
                  value={friendSearch} 
                  onChange={e => setFriendSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                       const target = allUsers.find(u => u.username.toLowerCase() === friendSearch.toLowerCase() && !u.isGuest && u.id !== user.id);
                       if (target) { handleSocialAction(target.id, 'request'); setFriendSearch(''); }
                       else showToast("Not found", "err");
                    }
                  }}
                />
             </div>
           )}

           <div className="space-y-1">
              {user.friends?.length === 0 ? (
                 <p className="text-[7px] text-slate-800 italic uppercase font-bold text-center py-4 mobile-hide">Empty</p>
              ) : (
                 user.friends?.map(fId => {
                   const friend = allUsers.find(u => u.id === fId);
                   if (!friend) return null;
                   return (
                     <div key={fId} onClick={() => setProfileUserId(friend.id)} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group">
                       <div className="relative shrink-0">
                         <img src={friend.avatar} className="w-7 h-7 rounded-lg grayscale group-hover:grayscale-0 transition-all border border-white/5" />
                         {isOnline(friend) && <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0c]"></div>}
                       </div>
                       <p className="flex-1 text-[9px] font-black uppercase text-slate-400 group-hover:text-white truncate italic mobile-hide">{friend.username}</p>
                     </div>
                   );
                 })
              )}
           </div>
        </div>

        <div className="p-3 border-t border-white/5 bg-black/20">
           <div className="flex flex-col gap-2">
             <button onClick={() => setProfileUserId(user.id)} className="flex items-center gap-3 group">
               <img src={user.avatar} className="w-8 h-8 rounded-xl border border-white/10 hover:scale-105 transition-all" />
               <div className="flex-1 min-w-0 text-left mobile-hide">
                  <p className="text-[9px] font-black text-white truncate uppercase italic">{user.username}</p>
                  <p className="text-[6px] font-black text-indigo-500 uppercase">SETTINGS</p>
               </div>
             </button>
             <button onClick={() => window.location.reload()} className="p-2 text-slate-600 hover:text-rose-500 transition-colors flex justify-center"><Icons.LogOut /></button>
           </div>
        </div>
      </div>

      {/* 2. WORKSPACE SIDEBAR (Middle) */}
      <div className="w-[200px] bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl mobile-hide">
        <div className="p-4 border-b border-white/5 flex items-center justify-between h-14">
          <span className="font-black text-[9px] uppercase tracking-[0.2em] text-indigo-400 italic">RESEARCH</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scroll">
          {!user.isGuest && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-1 pr-2">
                <input 
                  type="text" 
                  placeholder="NEW LAB..." 
                  className="flex-1 bg-transparent px-2 py-1.5 text-[9px] outline-none text-white font-bold uppercase italic placeholder:text-slate-700"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                />
                <button onClick={handleCreateGroup} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all"><Icons.Plus /></button>
              </div>
            </div>
          )}

          <div>
            <button onClick={() => handleSwitchGroup('live-space')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${activeGroupId === 'live-space' ? 'bg-indigo-600 text-white shadow-lg border-indigo-500' : 'hover:bg-white/5 border-transparent opacity-60'}`}>
              <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[9px] font-black uppercase tracking-widest italic">Live Hub</span>
            </button>
          </div>

          <div className="space-y-1">
             {groups.filter(g => g.id !== 'live-space').map(g => (
               <button key={g.id} onClick={() => handleSwitchGroup(g.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all border ${activeGroupId === g.id ? 'bg-[#1a1a20] text-white border-white/10 shadow-md' : 'hover:bg-white/5 border-transparent opacity-80'}`}>
                 <div className="w-1 h-1 rounded-full bg-slate-700 opacity-20"></div>
                 <span className="text-[9px] font-black truncate uppercase tracking-tighter italic">{g.name}</span>
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* 3. WORKSPACE (Main) */}
      <div className="flex-1 flex flex-col relative bg-[#050505] mobile-full">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Icons.Sparkles />
             <h2 className="text-sm font-black uppercase tracking-[0.4em] mt-6 italic">Select a Lab</h2>
          </div>
        ) : (
          <>
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0 z-20">
               <div className="flex items-center gap-3 min-w-0">
                  <h2 className="font-black text-[12px] text-white italic uppercase tracking-tighter truncate">{activeGroup.name}</h2>
                  {activeGroupId !== 'live-space' && (
                    <div className="flex gap-1.5">
                       <button onClick={() => {
                        const link = `${window.location.origin}${window.location.pathname}?room=${activeGroup.id}`;
                        // Corrected redundant .clipboard property access
                        navigator.clipboard.writeText(link);
                        showToast("Copied!");
                      }} className="flex items-center gap-1 px-2 py-1 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-all text-[7px] font-black uppercase tracking-widest border border-white/5">
                        <Icons.Copy /> Link
                      </button>
                      <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[7px] font-black uppercase tracking-widest border border-indigo-500/20 mobile-hide">
                        {activeGroup.id}
                      </span>
                    </div>
                  )}
               </div>
               
               <div className="flex items-center gap-4">
                  {activeGroupId === 'live-space' && (
                    <div className="flex bg-white/5 rounded-xl p-0.5 border border-white/5">
                      <button onClick={() => setActiveTab('chat')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Chat</button>
                      <button onClick={() => setActiveTab('ask')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeTab === 'ask' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Feedback</button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                     <div className={`w-1 h-1 rounded-full ${activeGroupId === 'live-space' ? 'bg-emerald-500' : 'bg-slate-500'} mobile-hide`}></div>
                     <button onClick={() => setShowAbout(true)} className="text-[7px] bg-white/5 px-2 py-1 rounded-lg uppercase font-black tracking-widest hover:bg-white/10 transition-all border border-white/5">Members</button>
                  </div>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col relative">
                {activeTab === 'chat' ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scroll">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex items-center justify-center opacity-10 italic text-[10px] uppercase font-black tracking-widest">No signals...</div>
                      )}
                      {chatMessages.map(msg => (
                        msg.type === 'system' ? (
                          <div key={msg.id} className="text-center py-2"><span className="px-3 py-1 rounded-full bg-indigo-500/5 text-[7px] font-black text-indigo-400/40 uppercase tracking-widest italic">{msg.text}</span></div>
                        ) : (
                          <MessageComponent 
                            key={msg.id} 
                            msg={msg} 
                            me={user!} 
                            isAdmin={user.id === activeGroup?.ownerId}
                            onAvatarClick={() => setProfileUserId(msg.senderId)}
                            onReply={() => setReplyingTo(msg)} 
                            onEdit={(txt:string) => handleEditMessage(msg.id, txt)}
                            onReact={(id:string,e:string) => {
                              const msgKey = `cl_msgs_${activeGroupId}`;
                              const all = getFromStorage(msgKey) || [];
                              const idx = all.findIndex((m:any) => m.id === id);
                              if(idx > -1) {
                                const reactions = all[idx].reactions || [];
                                const rIdx = reactions.findIndex((r:Reaction) => r.emoji === e);
                                if(rIdx > -1) {
                                  if(reactions[rIdx].userIds.includes(user.id)) reactions[rIdx].userIds = reactions[rIdx].userIds.filter((uid:string)=>uid!==user.id);
                                  else reactions[rIdx].userIds.push(user.id);
                                } else { reactions.push({emoji: e, userIds: [user.id]}); }
                                all[idx].reactions = reactions.filter((r:Reaction)=>r.userIds.length > 0);
                                saveToStorage(msgKey, all);
                                fetchData();
                              }
                            }} 
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
                    
                    <div className="p-3 sm:p-4 border-t border-white/5 bg-[#08080a]/30">
                      <div className="max-w-4xl mx-auto flex flex-col gap-2">
                        {replyingTo && (
                          <div className="bg-indigo-600/10 p-1.5 rounded-xl flex items-center justify-between border-l-2 border-indigo-600 text-[8px]">
                            <span className="font-black uppercase text-indigo-400 pl-2">Reply to {replyingTo.senderName}</span>
                            <button onClick={() => setReplyingTo(null)} className="p-1"><Icons.X /></button>
                          </div>
                        )}
                        <div className="flex gap-2 sm:gap-3 items-center">
                          {activeGroupId !== 'live-space' && (
                            <button onClick={() => handleCallAction(activeGroup?.inCall?.includes(user.id) ? 'leave' : 'join')} className={`p-3 rounded-2xl transition-all ${activeGroup?.inCall?.includes(user.id) ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/20' : 'bg-white/5 text-indigo-500 border border-white/5 hover:scale-105'}`}>
                              <Icons.Phone />
                            </button>
                          )}
                          <ChatInput onSend={handleSendMessage} disabled={activeGroup?.mutedMembers?.includes(user.id)} />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in fade-in slide-in-from-bottom-5 custom-scroll overflow-y-auto">
                    <div className={`w-16 h-16 ${isAnalyzing ? 'animate-pulse bg-indigo-600/30' : 'bg-indigo-600/10'} text-indigo-500 rounded-3xl flex items-center justify-center mb-6`}>
                      <Icons.Sparkles />
                    </div>
                    <h3 className="text-sm font-black uppercase italic tracking-widest text-white mb-2">Lab Analysis</h3>
                    <p className="text-slate-500 text-[8px] uppercase font-bold tracking-widest mb-8">AI Intelligence Insights</p>
                    
                    <div className="max-w-xl w-full bg-white/5 border border-white/10 rounded-[30px] p-8 text-left relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                       {isAnalyzing ? (
                         <div className="space-y-4">
                           <div className="h-2 bg-white/10 rounded w-3/4 animate-pulse"></div>
                           <div className="h-2 bg-white/10 rounded w-full animate-pulse"></div>
                           <div className="h-2 bg-white/10 rounded w-5/6 animate-pulse"></div>
                         </div>
                       ) : (
                         <div className="text-[11px] leading-relaxed text-slate-300 italic whitespace-pre-wrap">
                           {aiFeedback || "Start chatting in this lab to generate research summaries and actionable insights."}
                         </div>
                       )}
                    </div>
                    
                    <button onClick={() => setActiveTab('chat')} className="mt-10 px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[8px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all text-indigo-400">Return to Terminal</button>
                  </div>
                )}
              </div>

              {/* ASSET LAB (Files) */}
              {activeGroupId !== 'live-space' && (
                <div className="w-[260px] bg-[#0a0a0c] border-l border-white/5 flex flex-col shrink-0 mobile-hide">
                  <div className="p-4 border-b border-white/5 bg-indigo-600/5">
                     <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">ACTIVE CALL</span>
                     <div className="mt-3 space-y-1.5">
                        {usersInCall.map(u => (
                          <div key={u.id} className={`flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5 transition-all ${Math.random() > 0.8 ? 'ring-1 ring-emerald-500/20' : ''}`}>
                            <img src={u.avatar} className={`w-6 h-6 rounded-lg ${Math.random() > 0.8 ? 'ring-1 ring-emerald-500 animate-pulse' : ''}`} />
                            <span className="text-[9px] font-black uppercase text-white tracking-tighter italic truncate">{u.username}</span>
                          </div>
                        ))}
                        {usersInCall.length === 0 && <p className="text-[8px] text-slate-700 italic text-center py-4 uppercase font-bold tracking-widest">No active stream</p>}
                     </div>
                  </div>
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">ASSETS</span>
                    <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                    <label htmlFor="lab-up" className="p-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-500 transition-all shadow-lg scale-90"><Icons.Plus /></label>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scroll">
                     {labAssets.map(msg => (
                      <FileItem 
                        key={msg.id} 
                        file={msg.file!} 
                        sender={msg.senderName} 
                        canDelete={user.id === activeGroup?.ownerId || user.id === msg.senderId}
                        onDelete={() => {
                          const msgKey = `cl_msgs_${activeGroupId}`;
                          const all = getFromStorage(msgKey) || [];
                          saveToStorage(msgKey, all.filter((m:any)=>m.id!==msg.id));
                          fetchData();
                        }}
                        onDownload={() => triggerDownload(msg.file!)}
                        onPreview={async () => {
                          const blob = await getBlob(msg.file!.url);
                          if (blob) setSelectedFile({...msg.file!, url: URL.createObjectURL(blob)});
                          else showToast("Missing", 'err');
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

      {/* MODALS */}
      {showInbox && user && (
        <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-6" onClick={() => setShowInbox(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[30px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-black text-white italic uppercase tracking-widest mb-6 text-center">Requests</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                 {(user.friendRequests || []).length === 0 ? (
                    <div className="text-center py-10 opacity-20 italic uppercase font-black text-[9px]">Inbox Clear</div>
                 ) : (
                    user.friendRequests?.map(id => {
                      const requester = allUsers.find(au => au.id === id);
                      return requester ? (
                        <div key={id} className="bg-white/5 p-3 rounded-2xl flex items-center justify-between border border-white/5">
                          <div className="flex items-center gap-3">
                             <img src={requester.avatar} className="w-8 h-8 rounded-lg" />
                             <span className="text-[10px] font-black uppercase text-white italic">{requester.username}</span>
                          </div>
                          <div className="flex gap-1.5">
                             <button onClick={() => handleSocialAction(id, 'accept')} className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-500 transition-all scale-90"><Icons.Plus /></button>
                             <button onClick={() => handleSocialAction(id, 'deny')} className="p-2 bg-white/5 text-rose-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all scale-90"><Icons.X /></button>
                          </div>
                        </div>
                      ) : null;
                    })
                 )}
              </div>
              <button onClick={() => setShowInbox(false)} className="w-full mt-8 py-3 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all">Close</button>
           </div>
        </div>
      )}

      {/* REFINED PROFILE MODAL */}
      {profileUserId && (
        <div className="fixed inset-0 bg-black/95 z-[1100] flex items-center justify-center p-6" onClick={() => setProfileUserId(null)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[40px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 overflow-hidden relative" onClick={e => e.stopPropagation()}>
              {(() => {
                const target = allUsers.find(u => u.id === profileUserId) || (profileUserId === user.id ? user : null);
                if (!target) return <p className="text-center italic opacity-20 uppercase font-black">Not found</p>;
                const isMe = target.id === user.id;
                const labCount = groups.filter(g => g.members.includes(target.id)).length;
                
                return (
                  <div className="relative flex flex-col items-center">
                    <div className="absolute top-0 left-0 w-full h-24 bg-indigo-600 opacity-10 rounded-t-[40px] -mt-8"></div>
                    <img src={target.avatar} className="w-24 h-24 rounded-3xl border-4 border-[#0f0f12] shadow-2xl mb-4 mt-8 bg-black" />
                    <h3 className="text-lg font-black uppercase italic text-white tracking-tighter">{target.username}</h3>
                    <p className="text-slate-500 text-[8px] uppercase font-bold tracking-[0.3em] mb-6">{isMe ? (target.email || 'LOCAL ACCOUNT') : 'RESEARCH PARTNER'}</p>
                    
                    <div className="w-full grid grid-cols-2 gap-3 mb-6">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                          <p className="text-[12px] font-black text-indigo-400">{target.friends?.length || 0}</p>
                          <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Friends</p>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                          <p className="text-[12px] font-black text-white">{labCount}</p>
                          <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Labs</p>
                       </div>
                    </div>

                    {isMe ? (
                      <div className="w-full space-y-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                           <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest block mb-3">Your Chat Color</span>
                           <div className="flex justify-center gap-2">
                             {CHAT_COLORS.map(c => (
                               <button 
                                key={c} 
                                onClick={() => handleUpdateSelf({ chatColor: c })} 
                                className={`w-6 h-6 rounded-full border-2 transition-all ${user.chatColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} 
                                style={{ backgroundColor: c }} 
                               />
                             ))}
                           </div>
                        </div>
                        <button 
                          onClick={() => handleUpdateSelf({ avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}` })} 
                          className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[8px] tracking-widest hover:bg-indigo-500 transition-all shadow-lg"
                        >
                          Change Appearance
                        </button>
                      </div>
                    ) : (
                       !user.isGuest && !user.friends?.includes(target.id) && target.id !== 'system' && (
                         <button onClick={() => handleSocialAction(target.id, 'request')} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[8px] tracking-widest hover:bg-indigo-500 transition-all shadow-lg">Send Friend Request</button>
                       )
                    )}

                    <button onClick={() => setProfileUserId(null)} className="w-full py-3 mt-3 bg-white/5 text-slate-500 rounded-2xl font-black uppercase text-[8px] tracking-widest hover:text-white transition-all">Close</button>
                  </div>
                );
              })()}
           </div>
        </div>
      )}

      {showAbout && activeGroupId && activeGroupId !== 'live-space' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black italic text-sm uppercase tracking-widest text-white">Lab Lab</h3>
                 <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-white/5 rounded-lg"><Icons.X /></button>
              </div>
              
              {user.id === activeGroup.ownerId && (
                <div className="mb-6">
                   <span className="text-[7px] font-black uppercase text-indigo-400 tracking-widest block mb-3">Invite Friends</span>
                   <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto custom-scroll pr-1">
                      {user.friends?.filter(fid => !activeGroup.members.includes(fid)).length === 0 ? (
                        <p className="text-[7px] text-slate-700 italic uppercase font-bold text-center py-2">No invites available</p>
                      ) : (
                        user.friends?.filter(fid => !activeGroup.members.includes(fid)).map(fid => {
                           const friend = allUsers.find(u => u.id === fid);
                           return friend ? (
                              <button key={fid} onClick={() => handleAddMemberToGroup(fid)} className="flex items-center justify-between p-2 rounded-xl bg-indigo-600/5 hover:bg-indigo-600/10 transition-all group/f">
                                 <div className="flex items-center gap-2">
                                    <img src={friend.avatar} className="w-5 h-5 rounded-lg" />
                                    <span className="text-[8px] font-bold text-white uppercase">{friend.username}</span>
                                 </div>
                                 <Icons.Plus />
                              </button>
                           ) : null;
                        })
                      )}
                   </div>
                </div>
              )}

              <div className="space-y-1.5 mb-6 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                {allUsers.filter(u => activeGroup?.members?.includes(u.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setShowAbout(false); setProfileUserId(m.id); }}>
                      <img src={m.avatar} className="w-7 h-7 rounded-lg" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-white italic">{m.username}</span>
                        {activeGroup?.ownerId === m.id && <span className="text-[6px] text-indigo-500 font-bold uppercase tracking-widest">Admin</span>}
                      </div>
                    </div>
                    {user.id === activeGroup?.ownerId && m.id !== user.id && (
                      <button onClick={() => handleAdminAction(m.id, 'kick')} className="text-[7px] font-black text-rose-500 uppercase px-2 py-1 bg-rose-500/10 rounded-lg hover:bg-rose-600 hover:text-white transition-all">Kick</button>
                    )}
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 bg-black/95 z-[2000] flex flex-col items-center justify-center p-10" onClick={() => setSelectedFile(null)}>
           <button onClick={() => setSelectedFile(null)} className="absolute top-10 right-10 p-4 bg-white/5 text-white rounded-full hover:bg-rose-600 transition-all z-50"><Icons.X /></button>
           <div className="max-w-4xl w-full max-h-[80vh] flex items-center justify-center rounded-[40px] overflow-hidden shadow-2xl border border-white/5 bg-black/40" onClick={e => e.stopPropagation()}>
              {selectedFile.type.startsWith('image/') ? (
                 <img src={selectedFile.url} className="max-w-full max-h-full object-contain" />
              ) : selectedFile.type.startsWith('video/') ? (
                 <video src={selectedFile.url} className="max-w-full max-h-full" controls autoPlay />
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Icons.File /></div>
                  <p className="text-white font-black text-[12px] mb-8 uppercase tracking-widest italic truncate">{selectedFile.name}</p>
                  <a href={selectedFile.url} download={selectedFile.name} className="inline-block px-10 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 shadow-xl shadow-indigo-600/20">Download Asset</a>
                </div>
              )}
           </div>
        </div>
      )}
      
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000] px-5 py-2.5 rounded-2xl font-black uppercase text-[8px] tracking-[0.2em] shadow-2xl animate-in slide-in-from-bottom-4 ${toast.t === 'err' ? 'bg-rose-600 text-white shadow-rose-600/20' : 'bg-emerald-600 text-white shadow-emerald-600/20'}`}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

const MessageComponent = ({ msg, me, isAdmin, onAvatarClick, onReply, onReact, onDelete, onEdit }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const contrastText = getContrastColor(msg.color);
  
  const handleSave = () => {
    onEdit(editText);
    setIsEditing(false);
    setShowMenu(false);
  };

  return (
    <div className={`flex gap-3 group/msg ${msg.senderId === me.id ? 'flex-row-reverse' : ''}`} onClick={() => setShowMenu(!showMenu)}>
      <div className="relative shrink-0">
        <img 
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} 
          className="w-8 h-8 rounded-lg bg-black border border-white/5 cursor-pointer hover:scale-110 transition-transform" 
          onClick={(e) => { e.stopPropagation(); onAvatarClick(); }}
        />
      </div>
      <div className={`flex flex-col max-w-[75%] relative ${msg.senderId === me.id ? 'items-end' : 'items-start ml-1'}`}>
        <span className="text-[7px] font-black uppercase tracking-[0.1em] mb-1 px-1 opacity-20 italic">
          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} {msg.isEdited && "(MODIFIED)"}
        </span>
        
        <div className={`p-2.5 px-4 rounded-2xl text-[12px] leading-snug transition-all relative shadow-lg ${msg.senderId === me.id ? 'rounded-tr-none' : 'rounded-tl-none border border-white/5'}`} style={{ backgroundColor: msg.color || '#121216', color: contrastText }}>
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea 
                className="bg-black/20 border border-white/10 rounded p-2 text-inherit outline-none resize-none text-[12px]" 
                value={editText} 
                onChange={e => setEditText(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} className="text-[8px] font-bold uppercase">Cancel</button>
                <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="text-[8px] font-bold uppercase underline">Save</button>
              </div>
            </div>
          ) : (
            msg.text
          )}
        </div>

        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msg.reactions.map((r: Reaction) => (
              <button key={r.emoji} onClick={(e) => { e.stopPropagation(); onReact(msg.id, r.emoji); }} className={`px-2 py-0.5 rounded-full text-[8px] bg-white/5 border border-white/10 flex items-center gap-1 transition-all hover:bg-white/10 ${r.userIds.includes(me.id) ? 'bg-indigo-600/20 border-indigo-500' : ''}`}>
                <span>{r.emoji}</span> <span className="font-bold opacity-40">{r.userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {showMenu && !isEditing && (
          <div className={`absolute -top-12 flex flex-col bg-[#1a1a20] border border-white/10 rounded-2xl p-1 shadow-2xl z-50 animate-in zoom-in-95 ${msg.senderId === me.id ? 'right-0' : 'left-0'}`}>
            <div className="flex items-center gap-0.5 p-1">
              {EMOJIS.map(e => (
                <button key={e} onClick={(e_sub) => { e_sub.stopPropagation(); onReact(msg.id, e); setShowMenu(false); }} className="p-1 hover:bg-white/10 rounded text-xs transition-transform active:scale-125">{e}</button>
              ))}
            </div>
            <div className="h-px bg-white/5 w-full my-0.5"></div>
            <div className="flex justify-between px-1.5 py-1 gap-1.5">
              <button onClick={(e) => { e.stopPropagation(); onReply(); setShowMenu(false); }} className="text-slate-400 p-1 hover:bg-white/5 rounded-lg" title="Reply"><Icons.Reply /></button>
              {msg.senderId === me.id && <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="text-slate-400 p-1 hover:bg-white/5 rounded-lg" title="Edit"><Icons.Edit /></button>}
              {(msg.senderId === me.id || isAdmin) && <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg" title="Delete"><Icons.Trash /></button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInput: React.FC<{ onSend: (t: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const handleSend = () => { if(text.trim() && !disabled) { onSend(text); setText(''); } };
  return (
    <div className={`flex-1 flex items-end gap-2 bg-[#0f0f12] border border-white/5 rounded-2xl p-1.5 focus-within:border-indigo-500/30 transition-all ${disabled ? 'opacity-20 grayscale' : ''}`}>
      <textarea rows={1} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? "MUTED" : "SIGNAL..."} className="flex-1 bg-transparent py-2 px-3 text-[12px] outline-none resize-none text-white placeholder:text-slate-800 font-bold uppercase italic custom-scroll" />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className={`p-3 rounded-xl transition-all shadow-lg active:scale-95 ${text.trim() && !disabled ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-800'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, canDelete: boolean, onDelete: () => void, onPreview: () => void, onDownload: () => void }> = ({ file, sender, canDelete, onDelete, onPreview, onDownload }) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const isImg = file.type.startsWith('image/');

  useEffect(() => {
     if (isImg) {
        getBlob(file.url).then(blob => {
           if (blob) setImgUrl(URL.createObjectURL(blob));
        });
     }
     return () => { if (imgUrl) URL.revokeObjectURL(imgUrl); };
  }, [file.url]);

  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden shadow-xl group animate-in zoom-in-95 border-l-2 border-indigo-600 relative">
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-500 scale-90" title="Get"><Icons.Download /></button>
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-500 scale-90" title="Delete"><Icons.X /></button>
        )}
      </div>
      <div className="cursor-pointer aspect-video bg-black flex items-center justify-center relative overflow-hidden" onClick={onPreview}>
         {isImg && imgUrl ? (
            <img src={imgUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
         ) : isImg ? (
            <div className="text-slate-900 scale-125"><Icons.Sparkles /></div>
         ) : (
            <div className="text-slate-900"><Icons.File /></div>
         )}
         <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[7px] font-black text-white uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full">OPEN SIGNAL</span>
         </div>
      </div>
      <div className="p-2.5">
        <p className="text-[9px] font-black text-white truncate uppercase tracking-tighter italic">{file.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[7px] font-black text-indigo-500 uppercase">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
          <span className="text-[7px] text-slate-700 font-bold uppercase italic truncate ml-2">SRC: {sender}</span>
        </div>
      </div>
    </div>
  );
};
