
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Group, Message, SharedFile, Reaction } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, CHAT_COLORS, getContrastColor, EMOJIS } from './constants';

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

// --- Components ---

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
        targetRoomId = roomToJoin || undefined;
      } else {
        targetRoomId = roomCode.toUpperCase();
      }
      
      onAuth(guest, targetRoomId);
      return;
    }

    if (mode === 'login') {
      const user = users.find((u) => u.email === email || u.username === email);
      if (user) onAuth(user, roomToJoin || undefined);
      else alert('Korisnik nije pronađen');
    } else {
      if (users.some(u => u.username === username)) { alert("Username zauzet!"); return; }
      const newUser: User = { id: Math.random().toString(36).substring(2, 9), email, username, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, plan: 'free', friends: [], chatColor: CHAT_COLORS[0] };
      users.push(newUser);
      saveToStorage('cl_users', users);
      onAuth(newUser, roomToJoin || undefined);
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
              <button onClick={() => setMode('login')} className="w-full text-indigo-400 py-3 font-black uppercase text-[10px] tracking-widest hover:text-white underline">Sign In</button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-black text-white italic uppercase mb-6 text-center">
              {mode === 'join-link' || mode === 'join-code' ? 'Join Lab' : mode === 'guest' ? 'Guest Access' : mode === 'login' ? 'Login' : 'Signup'}
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [toast, setToast] = useState<{ m: string; t: 'ok' | 'err' } | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [lastSentTime, setLastSentTime] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string, t: 'ok' | 'err' = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 3000);
  };

  const isOnline = (u: User | string) => {
    const target = typeof u === 'string' ? allUsers.find(au => au.id === u) : u;
    return target?.lastSeen && (Date.now() - target.lastSeen < 12000);
  };

  const fetchData = () => {
    if (!user) return;
    const users: User[] = getFromStorage('cl_users') || [];
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    
    // Ensure "Live Hub" exists
    if (!allGroups.some(g => g.id === 'live-space')) {
       allGroups.push({ id: 'live-space', name: 'Live Hub', ownerId: 'system', members: [], createdAt: Date.now() });
       saveToStorage('cl_groups', allGroups);
    }

    setAllUsers(users);
    setGroups(allGroups.filter(g => g.members.includes(user.id) || g.id === 'live-space'));

    if (activeGroupId) {
      const msgKey = `cl_msgs_${activeGroupId}`;
      const groupMsgs: Message[] = getFromStorage(msgKey) || [];
      const filtered = groupMsgs.filter(m => m.type === 'system' || isOnline(m.senderId));
      
      setMessages(filtered);
      setOptimisticMessages(prev => prev.filter(om => !filtered.some(fm => fm.id === om.id)));
    }
  };

  // Immediate clear and fetch on group switch
  const handleSwitchGroup = (id: string) => {
    if (activeGroupId === id) return;
    setMessages([]);
    setOptimisticMessages([]);
    setReplyingTo(null);
    setActiveGroupId(id);
  };

  useEffect(() => {
    if (user) fetchData();
  }, [activeGroupId, user]);

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

  const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId]);

  const usersInCall = useMemo(() => {
    if (!activeGroup || !activeGroup.inCall) return [];
    return allUsers.filter(u => activeGroup.inCall!.includes(u.id));
  }, [activeGroup, allUsers]);

  const handleAuthSuccess = (u: User, autoGroupId?: string) => {
    setUser(u);
    // Refresh user list with the new/logged-in user
    const users: User[] = getFromStorage('cl_users') || [];
    if (!users.some(existing => existing.id === u.id)) {
      users.push(u);
      saveToStorage('cl_users', users);
    }

    if (autoGroupId) {
      const all: Group[] = getFromStorage('cl_groups') || [];
      const gIdx = all.findIndex((g:any) => g.id === autoGroupId);
      if (gIdx > -1) {
        if (!all[gIdx].members.includes(u.id)) {
          all[gIdx].members.push(u.id);
          saveToStorage('cl_groups', all);
          sendSystemMessage(autoGroupId, `${u.username} has entered the lab.`);
        }
        setActiveGroupId(autoGroupId);
        setGroups(all.filter((g:any) => g.members.includes(u.id) || g.id === 'live-space'));
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
    if (activeGroupId === 'live-space' && Date.now() - lastSentTime < 1000) { showToast("1s cooldown.", 'err'); return; }
    
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

  const handleCallAction = (action: 'join' | 'leave') => {
    if (!user || !activeGroupId) return;
    const all: Group[] = getFromStorage('cl_groups') || [];
    const idx = all.findIndex(g => g.id === activeGroupId);
    if (idx > -1) {
      let inCall = all[idx].inCall || [];
      if (action === 'join') {
        if (!inCall.includes(user.id)) inCall = [...inCall, user.id];
      } else {
        inCall = inCall.filter(uid => uid !== user.id);
      }
      all[idx].inCall = inCall;
      saveToStorage('cl_groups', all);
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

  const combinedMessages = useMemo(() => [...messages, ...optimisticMessages], [messages, optimisticMessages]);
  const onlineCount = useMemo(() => allUsers.filter(u => isOnline(u)).length, [allUsers]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [combinedMessages]);

  if (!user) return <AuthPage onAuth={handleAuthSuccess} />;

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-[280px] bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-indigo-400 italic">WORKSPACE</span>
          {!user.isGuest && <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Icons.Plus /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <button onClick={() => handleSwitchGroup('live-space')} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all border ${activeGroupId === 'live-space' ? 'bg-indigo-600 text-white shadow-lg border-indigo-500' : 'hover:bg-white/5 border-transparent opacity-60'}`}>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest italic">Live Hub</span>
          </button>
          <div className="h-px bg-white/5 my-4 mx-2"></div>
          {groups.filter(g => g.id !== 'live-space').map(g => (
            <button key={g.id} onClick={() => handleSwitchGroup(g.id)} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all border ${activeGroupId === g.id ? 'bg-[#1a1a20] text-white border-white/10 shadow-md' : 'hover:bg-white/5 border-transparent opacity-80'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
              <span className="text-[10px] font-black truncate uppercase tracking-tighter">{g.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 bg-black/40 border-t border-white/5">
           <div className="flex items-center gap-3">
             <img src={user.avatar} className="w-9 h-9 rounded-xl border border-white/10" />
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate uppercase italic">{user.username}</p>
                <p className="text-[7px] font-black text-indigo-500 uppercase tracking-widest">{user.plan}</p>
             </div>
             <button onClick={() => window.location.reload()} className="text-slate-600 hover:text-rose-500 p-2"><Icons.LogOut /></button>
           </div>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 flex flex-col relative bg-[#050505]">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Icons.Sparkles />
             <h2 className="text-sm font-black uppercase tracking-[0.4em] mt-6 italic">Select a Lab</h2>
          </div>
        ) : (
          <>
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0 z-20">
               <div className="flex items-center gap-4">
                  <h2 className="font-black text-sm text-white italic uppercase tracking-tighter">{activeGroup.name}</h2>
                  {activeGroupId !== 'live-space' && (
                    <div className="flex gap-2">
                       <button onClick={() => {
                        const link = `${window.location.origin}${window.location.pathname}?room=${activeGroup.id}`;
                        navigator.clipboard.writeText(link);
                        showToast("Link Copied!");
                      }} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-all text-[8px] font-black uppercase tracking-widest border border-white/5">
                        <Icons.Copy /> Link
                      </button>
                      <button onClick={() => {
                        navigator.clipboard.writeText(activeGroup.id);
                        showToast("Code Copied: " + activeGroup.id);
                      }} className="px-3 py-1.5 bg-white/5 text-indigo-500 hover:text-white rounded-lg transition-all text-[8px] font-black uppercase tracking-widest border border-indigo-500/20">
                        Code: {activeGroup.id}
                      </button>
                    </div>
                  )}
               </div>
               <div className="flex items-center gap-4">
                  {activeGroupId === 'live-space' ? (
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase text-emerald-500 italic tracking-widest">Online: {onlineCount}</span>
                     </div>
                  ) : (
                    <>
                      <div className="flex -space-x-1.5">
                        {allUsers.filter(u => activeGroup.members.includes(u.id)).slice(0, 5).map(m => (
                          <img key={m.id} src={m.avatar} className={`w-7 h-7 rounded-lg border-2 border-[#050505]`} title={m.username} />
                        ))}
                      </div>
                      <button onClick={() => setShowAbout(true)} className="text-[8px] bg-white/5 px-3 py-1.5 rounded-lg uppercase font-black tracking-widest hover:bg-white/10 transition-all border border-white/5">Members</button>
                    </>
                  )}
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col relative">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {combinedMessages.length === 0 && (
                    <div className="h-full flex flex-center items-center justify-center opacity-10 italic text-[10px] uppercase font-black tracking-widest">No messages yet</div>
                  )}
                  {combinedMessages.map(msg => (
                    msg.type === 'system' ? (
                      <div key={msg.id} className="text-center py-4"><span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-[9px] font-black text-emerald-400 uppercase tracking-widest italic border border-emerald-500/20">{msg.text}</span></div>
                    ) : (
                      <MessageComponent key={msg.id} msg={msg} me={user!} onReply={() => setReplyingTo(msg)} onReact={(id:string,e:string) => {
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
                      }} onDelete={() => {
                        const msgKey = `cl_msgs_${activeGroupId}`;
                        const all = getFromStorage(msgKey) || [];
                        saveToStorage(msgKey, all.filter((m:any)=>m.id!==msg.id));
                        showToast("Message Deleted");
                        fetchData();
                      }} />
                    )
                  ))}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-4 border-t border-white/5 bg-[#08080a]/50">
                  <div className="max-w-4xl mx-auto flex flex-col gap-2">
                    {replyingTo && (
                      <div className="bg-indigo-600/10 p-2 rounded-xl flex items-center justify-between border-l-4 border-indigo-600 text-[10px]">
                         <span className="font-black uppercase text-indigo-400 pl-2">Replying to {replyingTo.senderName}</span>
                         <button onClick={() => setReplyingTo(null)} className="p-1"><Icons.X /></button>
                      </div>
                    )}
                    <div className="flex gap-3 items-center">
                      {activeGroupId !== 'live-space' && (
                        <button onClick={() => handleCallAction(activeGroup?.inCall?.includes(user.id) ? 'leave' : 'join')} className={`p-3.5 rounded-2xl transition-all ${activeGroup?.inCall?.includes(user.id) ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/20' : 'bg-white/5 text-indigo-500 hover:bg-white/10 border border-white/5'}`}>
                          <Icons.Phone />
                        </button>
                      )}
                      <ChatInput onSend={handleSendMessage} disabled={activeGroup?.mutedMembers?.includes(user.id)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ASSET LAB (Hidden in Live Hub) */}
              {activeGroupId !== 'live-space' && (
                <div className="w-[340px] bg-[#0a0a0c] border-l border-white/5 flex flex-col shrink-0">
                  <div className="p-5 border-b border-white/5 bg-indigo-600/5">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">CALL LAB</span>
                     <div className="mt-4 space-y-2">
                        {usersInCall.map(u => (
                          <div key={u.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${u.isSpeaking ? 'bg-emerald-600/10 ring-1 ring-emerald-500/30' : 'bg-white/5'}`}>
                            <img src={u.avatar} className={`w-7 h-7 rounded-lg ${u.isSpeaking ? 'ring-2 ring-emerald-500' : ''}`} />
                            <span className="text-[10px] font-black uppercase text-white tracking-tighter italic">{u.username}</span>
                            {u.isSpeaking && <div className="flex gap-0.5 ml-auto"><div className="w-0.5 h-3 bg-emerald-500 animate-bounce"></div><div className="w-0.5 h-3 bg-emerald-500 animate-bounce delay-75"></div></div>}
                          </div>
                        ))}
                        {usersInCall.length === 0 && <p className="text-[9px] text-slate-700 italic text-center py-4 uppercase font-bold tracking-widest">Quiet Room</p>}
                     </div>
                  </div>
                  <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">ASSETS</span>
                    <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                    <label htmlFor="lab-up" className="p-2.5 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-500 transition-all shadow-lg"><Icons.Paperclip /></label>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                     {messages.filter(m => m.type === 'file').map(msg => (
                      <FileItem key={msg.id} file={msg.file!} sender={msg.senderName} onPreview={async () => {
                        const blob = await getBlob(msg.file!.url);
                        if (blob) setSelectedFile({...msg.file!, url: URL.createObjectURL(blob)});
                        else showToast("File expired or deleted from DB", 'err');
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-6" onClick={() => setShowCreateGroup(false)}>
           <div className="bg-[#0f0f12] border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 text-center">New Lab</h3>
              <input type="text" placeholder="Lab Name..." className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold mb-4" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <button onClick={() => { handleCreateGroup(); setShowCreateGroup(false); }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">Create Lab</button>
           </div>
        </div>
      )}

      {showAbout && activeGroupId && activeGroupId !== 'live-space' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black italic text-sm uppercase tracking-widest text-white">Lab Members</h3>
                 <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-white/5 rounded-lg"><Icons.X /></button>
              </div>
              <div className="space-y-2.5">
                {allUsers.filter(u => activeGroup?.members?.includes(u.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} className="w-8 h-8 rounded-lg" />
                      <span className="text-[10px] font-black uppercase text-white tracking-tighter italic">{m.username}</span>
                      {activeGroup?.ownerId === m.id && <span className="text-[7px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase font-bold border border-white/10">Admin</span>}
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col items-center justify-center p-10" onClick={() => setSelectedFile(null)}>
           <button onClick={() => setSelectedFile(null)} className="absolute top-10 right-10 p-4 bg-white/5 text-white rounded-full hover:bg-rose-600 transition-all z-50"><Icons.X /></button>
           <div className="max-w-4xl w-full max-h-[80vh] flex items-center justify-center rounded-3xl overflow-hidden shadow-2xl border border-white/5" onClick={e => e.stopPropagation()}>
              {selectedFile.type.startsWith('image/') && <img src={selectedFile.url} className="max-w-full max-h-full object-contain" />}
              {selectedFile.type.startsWith('video/') && <video src={selectedFile.url} className="max-w-full max-h-full" controls autoPlay />}
              {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/') && (
                <div className="bg-[#121216] p-12 rounded-3xl w-full max-w-md text-center">
                  <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Icons.Video /></div>
                  <p className="text-white font-black text-sm mb-8 uppercase tracking-widest italic truncate">{selectedFile.name}</p>
                  <a href={selectedFile.url} download={selectedFile.name} className="inline-block px-10 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 shadow-xl shadow-indigo-600/20">Download File</a>
                </div>
              )}
           </div>
        </div>
      )}
      
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in slide-in-from-bottom-4 ${toast.t === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

const MessageComponent = ({ msg, me, onReply, onReact, onDelete }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const contrastText = getContrastColor(msg.color);
  
  return (
    <div className={`flex gap-3 group/msg ${msg.senderId === me.id ? 'flex-row-reverse' : ''}`} onClick={() => setShowMenu(!showMenu)}>
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-8 h-8 rounded-lg bg-black shrink-0 border border-white/5" />
      <div className={`flex flex-col max-w-[80%] relative ${msg.senderId === me.id ? 'items-end' : ''}`}>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 px-1 opacity-40 italic">
          {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
        
        <div className={`p-2.5 px-4 rounded-2xl text-[13px] leading-snug transition-all relative shadow-lg ${msg.senderId === me.id ? 'rounded-tr-none' : 'rounded-tl-none border border-white/5'}`} style={{ backgroundColor: msg.color || '#121216', color: contrastText }}>
          {msg.text}
        </div>

        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msg.reactions.map((r: Reaction) => (
              <button key={r.emoji} onClick={(e) => { e.stopPropagation(); onReact(msg.id, r.emoji); }} className={`px-2 py-0.5 rounded-full text-[9px] bg-white/5 border border-white/10 flex items-center gap-1 transition-all hover:bg-white/10 ${r.userIds.includes(me.id) ? 'bg-indigo-600/20 border-indigo-500' : ''}`}>
                <span>{r.emoji}</span> <span className="font-bold opacity-60">{r.userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {showMenu && (
          <div className={`absolute -top-12 flex flex-col bg-[#1a1a20] border border-white/10 rounded-2xl p-1 shadow-2xl z-50 animate-in zoom-in-95 ${msg.senderId === me.id ? 'right-0' : 'left-0'}`}>
            <div className="flex items-center gap-0.5 max-w-[200px] overflow-x-auto p-1 scrollbar-hide">
              {EMOJIS.map(e => (
                <button key={e} onClick={(e_sub) => { e_sub.stopPropagation(); onReact(msg.id, e); setShowMenu(false); }} className="p-1.5 hover:bg-white/10 rounded-lg text-sm transition-transform active:scale-150">{e}</button>
              ))}
            </div>
            <div className="h-px bg-white/5 w-full my-1"></div>
            <div className="flex justify-between px-2 py-1">
              <button onClick={(e) => { e.stopPropagation(); onReply(); setShowMenu(false); }} className="text-indigo-400 p-1.5 hover:bg-indigo-500/10 rounded-lg"><Icons.Reply /></button>
              {msg.senderId === me.id && <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="text-rose-500 p-1.5 hover:bg-rose-500/10 rounded-lg"><Icons.Trash /></button>}
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
    <div className={`flex-1 flex items-end gap-2 bg-[#0f0f12] border border-white/5 rounded-2xl p-2 focus-within:border-indigo-500/40 transition-all ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
      <textarea rows={1} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? "Access Denied" : "Type something..."} className="flex-1 bg-transparent py-2.5 px-4 text-[13px] outline-none resize-none text-white placeholder:text-slate-700 font-medium" />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className={`p-3 rounded-xl transition-all shadow-xl active:scale-95 ${text.trim() && !disabled ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white/5 text-slate-700'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, onPreview: () => void }> = ({ file, sender, onPreview }) => {
  const isImg = file.type.startsWith('image/');
  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden shadow-xl group animate-in zoom-in-95 border-l-2 border-indigo-600">
      <div className="cursor-pointer aspect-video bg-black flex items-center justify-center relative overflow-hidden" onClick={onPreview}>
         {isImg ? <div className="text-slate-800 scale-150"><Icons.Sparkles /></div> : <div className="text-slate-800"><Icons.File /></div>}
         <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-black text-white uppercase tracking-widest bg-black/50 px-3 py-1.5 rounded-full">Open</span>
         </div>
      </div>
      <div className="p-3">
        <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter italic">{file.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] font-black text-indigo-500 uppercase">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
          <span className="text-[8px] text-slate-600 font-bold uppercase italic">by {sender}</span>
        </div>
      </div>
    </div>
  );
};
