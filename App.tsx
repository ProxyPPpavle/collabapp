
import React, { useState, useEffect, useRef } from 'react';
// Fixed: Removed unused and missing FriendRequest and GroupInvite types from import
import { User, Group, Message, SharedFile } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, CHAT_COLORS } from './constants';

const saveToStorage = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const getFromStorage = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const AuthPage: React.FC<{ onAuth: (user: User) => void }> = ({ onAuth }) => {
  const [mode, setMode] = useState<'entry' | 'login' | 'signup' | 'guest'>('entry');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(CHAT_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users: User[] = getFromStorage('cl_users') || [];
    
    if (mode === 'guest') {
      const guest: User = {
        id: 'gst_' + Math.random().toString(36).substring(2, 9),
        username: username || 'Guest',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || Math.random()}`,
        plan: 'guest',
        friends: [],
        chatColor: color,
        isGuest: true
      };
      onAuth(guest);
      return;
    }

    if (mode === 'login') {
      const user = users.find((u) => u.email === email || u.username === email);
      if (user) onAuth(user);
      else alert('Korisnik nije pronađen');
    } else {
      if (users.some(u => u.username === username)) {
        alert("Username zauzet!"); return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substring(2, 9),
        email,
        username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        plan: 'free',
        friends: [],
        chatColor: CHAT_COLORS[0]
      };
      users.push(newUser);
      saveToStorage('cl_users', users);
      onAuth(newUser);
    }
  };

  if (mode === 'entry') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
        <div className="bg-[#0f0f12] border border-white/10 p-12 rounded-2xl w-full max-w-lg shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-600/20 text-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
            <Icons.Video />
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Collab Lab</h1>
          <p className="text-slate-500 text-sm mb-12 uppercase tracking-[0.3em] font-bold">Fast Workspace Hub</p>
          
          <div className="space-y-4">
            <button onClick={() => setMode('guest')} className="w-full bg-indigo-600 text-white py-5 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all">Create Fast Group</button>
            <button onClick={() => setMode('login')} className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-white/10 transition-all">Make an Account</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-black text-white italic uppercase mb-8">{mode === 'guest' ? 'Postani Gost' : mode === 'login' ? 'Login' : 'Registracija'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'login' && (
            <input type="text" placeholder="Ime..." required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          {mode !== 'guest' && (
            <input type="text" placeholder="Email ili Username" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
          {mode === 'guest' && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-3 px-1">Tvoja Boja</label>
              <div className="flex gap-2">
                {CHAT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}
          {mode !== 'guest' && (
            <input type="password" placeholder="Lozinka" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500">
            {mode === 'guest' ? 'Započni Lab' : 'Potvrdi'}
          </button>
        </form>
        <button onClick={() => setMode('entry')} className="w-full mt-6 text-slate-600 text-[10px] uppercase font-black tracking-widest hover:text-white transition-all">Nazad</button>
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
  const [showProfile, setShowProfile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [lastSentTime, setLastSentTime] = useState(0);
  const [liveTab, setLiveTab] = useState<'chat' | 'ask'>('chat');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string, t: 'ok' | 'err' = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 3000);
  };

  const isOnline = (u: User | string) => {
    const target = typeof u === 'string' ? allUsers.find(au => au.id === u) : u;
    return target?.lastSeen && (Date.now() - target.lastSeen < 12000);
  };

  // Sync Logic
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const users: User[] = getFromStorage('cl_users') || [];
      const meIdx = users.findIndex(u => u.id === user.id);
      if (meIdx > -1) {
        users[meIdx].lastSeen = Date.now();
        saveToStorage('cl_users', users);
        setAllUsers(users);
      } else if (user.isGuest) {
        // Gosti se ne čuvaju u listi usera ali imamo ih u allUsers za session
        setAllUsers(prev => {
          const others = prev.filter(p => p.id !== user.id);
          return [...others, { ...user, lastSeen: Date.now() }];
        });
      }

      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      const myGroups = allGroups.filter(g => g.members.includes(user.id));
      
      // Ensure Live Space exists
      if (!allGroups.some(g => g.id === 'live-space')) {
        const ls: Group = { id: 'live-space', name: 'Live Space Hub', ownerId: 'system', members: [], createdAt: Date.now() };
        saveToStorage('cl_groups', [...allGroups, ls]);
      }
      
      setGroups(myGroups);

      if (activeGroupId) {
        const msgKey = `cl_msgs_${activeGroupId}`;
        const groupMsgs: Message[] = getFromStorage(msgKey) || [];
        const filtered = groupMsgs.filter(m => {
          if (m.type === 'file') return isOnline(m.senderId);
          return true;
        });
        if (JSON.stringify(filtered) !== JSON.stringify(messages)) setMessages(filtered);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [user, activeGroupId, messages, allUsers]);

  // Handle Join by URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && user && !groups.some(g => g.id === room)) {
      const all = getFromStorage('cl_groups') || [];
      const gIdx = all.findIndex((g:any) => g.id === room);
      if (gIdx > -1) {
        all[gIdx].members = [...new Set([...all[gIdx].members, user.id])];
        saveToStorage('cl_groups', all);
        sendSystemMessage(room, `${user.username} se pridružio labu.`);
        setActiveGroupId(room);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [user, groups]);

  const sendSystemMessage = (groupId: string, text: string) => {
    const msgKey = `cl_msgs_${groupId}`;
    const existing = getFromStorage(msgKey) || [];
    const sysMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      groupId,
      senderId: 'system',
      senderName: 'SYSTEM',
      text,
      type: 'system',
      timestamp: Date.now(),
      expiresAt: Date.now() + EXPIRY_DURATION
    };
    saveToStorage(msgKey, [...existing, sysMsg]);
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    
    // Cooldown for Live Space
    if (activeGroupId === 'live-space') {
      const now = Date.now();
      if (now - lastSentTime < 2000) { showToast("Sačekaj 2s (Cooldown)", 'err'); return; }
      setLastSentTime(now);
    }

    const group = groups.find(g => g.id === activeGroupId);
    if (group?.mutedMembers?.includes(user.id)) { showToast("Mutiran si!", 'err'); return; }

    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = user.isGuest ? PLAN_LIMITS.guest : PLAN_LIMITS[user.plan];
      if (file.size > limit) { showToast("Prevelik fajl!", 'err'); return; }
      sharedFile = { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) };
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
      color: user.chatColor
    };
    const msgKey = `cl_msgs_${activeGroupId}`;
    const existing = getFromStorage(msgKey) || [];
    saveToStorage(msgKey, [...existing, newMessage]);
    setMessages([...existing, newMessage]);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const gid = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newG: Group = { id: gid, name: newGroupName, ownerId: user!.id, members: [user!.id], createdAt: Date.now(), inCall: [] };
    const all = getFromStorage('cl_groups') || [];
    saveToStorage('cl_groups', [...all, newG]);
    setNewGroupName('');
    setShowCreateGroup(false);
    setActiveGroupId(gid);
    showToast("Soba spremna!");
  };

  const handleCallAction = (action: 'join' | 'leave' | 'share') => {
    if (!activeGroup) return;
    const all = getFromStorage('cl_groups') || [];
    const gIdx = all.findIndex((g:any) => g.id === activeGroupId);
    if (gIdx === -1) return;

    const inCall = all[gIdx].inCall || [];
    if (action === 'join') {
      all[gIdx].inCall = [...new Set([...inCall, user!.id])];
      showToast("Ušao si u voice kanal");
    } else if (action === 'leave') {
      all[gIdx].inCall = inCall.filter((id:string) => id !== user!.id);
      showToast("Napustio si voice");
    } else if (action === 'share') {
      showToast("Ekran se deli...");
    }
    saveToStorage('cl_groups', all);
  };

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeMembers = allUsers.filter(u => activeGroup?.members?.includes(u.id) ?? false);
  const usersInCall = allUsers.filter(u => activeGroup?.inCall?.includes(u.id) ?? false);

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden relative">
      {/* SIDEBAR */}
      <div className="w-[320px] bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="font-black text-[10px] uppercase tracking-widest text-indigo-400">Lab Explorer</span>
          <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><Icons.Plus /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Live Space Button */}
          <button onClick={() => setActiveGroupId('live-space')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${activeGroupId === 'live-space' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'hover:bg-white/5 border-transparent'}`}>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-[11px] font-black uppercase tracking-widest italic">Live Space Hub</span>
          </button>
          
          <div className="h-px bg-white/5 my-4 mx-2"></div>

          {groups.filter(g => g.id !== 'live-space').map(g => (
            <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'hover:bg-white/5 border-transparent'}`}>
              <div className="w-2 h-2 rounded-full bg-slate-700"></div>
              <span className="text-[11px] font-black truncate uppercase tracking-tighter">{g.name}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40">
           <div className="flex items-center gap-3">
             <button onClick={() => setShowProfile(true)} className="relative group shrink-0">
               <img src={user.avatar} className="w-10 h-10 rounded-xl border border-white/10" />
               <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 rounded-xl transition-all flex items-center justify-center text-[8px] font-black">EDIT</div>
             </button>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate italic uppercase">{user.username}</p>
                <p className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.2em]">{user.plan}</p>
             </div>
             <button onClick={() => setUser(null)} className="text-slate-600 hover:text-rose-500 p-2"><Icons.LogOut /></button>
           </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Icons.Sparkles />
             <h2 className="text-sm font-black uppercase tracking-widest mt-4">Select Lab</h2>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0">
               <div className="flex items-center gap-6">
                  <div>
                    <h2 className="font-black text-lg text-white italic uppercase tracking-tighter">{activeGroup.name}</h2>
                    {activeGroup.id !== 'live-space' && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">ID: {activeGroup.id}</span>}
                  </div>
                  {activeGroup.id !== 'live-space' && (
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${activeGroup.id}`);
                      showToast("Link kopiran!");
                    }} className="p-2 bg-white/5 hover:bg-indigo-600 text-slate-500 hover:text-white rounded-lg transition-all"><Icons.Copy /></button>
                  )}
               </div>

               {activeGroup.id === 'live-space' && (
                 <div className="flex bg-white/5 p-1 rounded-xl">
                   <button onClick={() => setLiveTab('chat')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${liveTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Live Chat</button>
                   <button onClick={() => setLiveTab('ask')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${liveTab === 'ask' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Ask Everyone</button>
                 </div>
               )}

               <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {activeMembers.slice(0, 4).map(m => (
                      <img key={m.id} src={m.avatar} onClick={() => setViewedUser(m)} className="w-8 h-8 rounded-lg border-2 border-[#050505] cursor-pointer hover:z-10 transition-all" />
                    ))}
                  </div>
                  <button onClick={() => setShowAbout(true)} className="text-[9px] bg-white/5 px-4 py-2 rounded-lg uppercase font-black tracking-widest hover:bg-indigo-600 transition-all">Members</button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* CHAT PANEL */}
              <div className="flex-1 flex flex-col border-r border-white/5">
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {liveTab === 'ask' && activeGroup.id === 'live-space' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 italic">
                      <Icons.Sparkles />
                      <p className="mt-4 text-xs font-bold uppercase tracking-widest">Dolazi uskoro...</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      msg.type === 'system' ? (
                        <div key={msg.id} className="text-center py-4">
                          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">{msg.text}</span>
                        </div>
                      ) : (
                        <div key={msg.id} className={`flex gap-4 ${msg.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} onClick={() => setViewedUser(allUsers.find(au => au.id === msg.senderId) || null)} className="w-9 h-9 rounded-lg bg-black shrink-0 border border-white/10 cursor-pointer" />
                          <div className={`flex flex-col max-w-[70%] ${msg.senderId === user.id ? 'items-end' : ''}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5 px-1" style={{ color: msg.color || '#6366f1' }}>{msg.senderName}</span>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#121216] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      )
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-6 border-t border-white/5 flex gap-4 items-center">
                  <button 
                    onClick={() => handleCallAction(activeGroup.inCall?.includes(user.id) ? 'leave' : 'join')}
                    className={`p-4 rounded-xl transition-all ${activeGroup.inCall?.includes(user.id) ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-indigo-500 hover:bg-white/10'}`}
                  >
                    <Icons.Phone />
                  </button>
                  <ChatInput onSend={handleSendMessage} disabled={activeGroup.mutedMembers?.includes(user.id)} />
                </div>
              </div>

              {/* ASSET & CALL LAB */}
              <div className="w-[380px] bg-[#0a0a0c] flex flex-col shrink-0">
                {/* Voice Call Lab */}
                <div className="p-6 border-b border-white/5 bg-indigo-600/5">
                   <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Call Lab</span>
                      <span className="text-[8px] font-bold text-slate-600">{usersInCall.length} Active</span>
                   </div>
                   {usersInCall.length === 0 ? (
                     <p className="text-[9px] text-slate-700 italic font-bold">Niko nije u pozivu</p>
                   ) : (
                     <div className="space-y-3">
                        {usersInCall.map(u => (
                          <div key={u.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                              <img src={u.avatar} className="w-6 h-6 rounded-lg" />
                              <span className="text-[10px] font-black uppercase text-white tracking-tighter">{u.username}</span>
                            </div>
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                          </div>
                        ))}
                        {activeGroup.inCall?.includes(user.id) && (
                          <button onClick={() => handleCallAction('share')} className="w-full mt-4 py-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Share Screen</button>
                        )}
                     </div>
                   )}
                </div>

                {/* Assets */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Lab</span>
                  <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                  <label htmlFor="lab-up" className="p-3 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-500 transition-all"><Icons.Paperclip /></label>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                   {messages.filter(m => m.type === 'file').map(msg => (
                    <FileItem key={msg.id} file={msg.file!} sender={msg.senderName} time={msg.timestamp} expiresAt={msg.expiresAt} onPreview={() => setSelectedFile(msg.file!)} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-6" onClick={() => setShowCreateGroup(false)}>
           <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-8 text-center">Novi Lab</h3>
              <input type="text" placeholder="Ime sobe..." className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-emerald-500 outline-none text-white font-bold mb-4" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <button onClick={handleCreateGroup} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500">Kreiraj</button>
           </div>
        </div>
      )}

      {showProfile && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
          <div className="bg-[#0f0f12] border border-indigo-500/30 rounded-2xl w-full max-w-sm p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-10">
              <label className="cursor-pointer group relative block w-24 h-24 mx-auto mb-6">
                <img src={user.avatar} className="w-24 h-24 rounded-2xl border-4 border-white/5 bg-black" />
                <input type="file" className="hidden" accept="image/*" onChange={e => {
                  const f = e.target.files?.[0];
                  if(f) {
                    const r = new FileReader();
                    r.onload = () => {
                      const base64 = r.result as string;
                      const users = getFromStorage('cl_users') || [];
                      const me = users.find((u:any) => u.id === user.id);
                      if(me) { me.avatar = base64; saveToStorage('cl_users', users); setUser({...me}); }
                    };
                    r.readAsDataURL(f);
                  }
                }} />
                <div className="absolute inset-0 bg-indigo-600/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-black uppercase">Upload</div>
              </label>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{user.username}</h3>
            </div>
            
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-4">Boja imena</label>
            <div className="flex justify-between mb-8">
              {CHAT_COLORS.map(c => (
                <button key={c} onClick={() => {
                   const users = getFromStorage('cl_users') || [];
                   const me = users.find((u:any) => u.id === user.id);
                   if(me) { me.chatColor = c; saveToStorage('cl_users', users); setUser({...me}); }
                }} className={`w-10 h-10 rounded-xl border-2 transition-all ${user.chatColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={() => setShowProfile(false)} className="w-full py-4 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest hover:text-white">Zatvori</button>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex flex-col items-center justify-center p-10" onClick={() => setSelectedFile(null)}>
           <button onClick={() => setSelectedFile(null)} className="absolute top-10 right-10 p-4 bg-white/5 text-white rounded-full hover:bg-rose-600 transition-all z-50"><Icons.X /></button>
           <div className="max-w-4xl w-full max-h-[80vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
              {selectedFile.type.startsWith('image/') && <img src={selectedFile.url} className="max-w-full max-h-full object-contain" />}
              {selectedFile.type.startsWith('video/') && <video src={selectedFile.url} className="max-w-full max-h-full" controls autoPlay />}
              {selectedFile.type.startsWith('audio/') && (
                <div className="bg-[#121216] p-10 rounded-2xl w-full max-w-md text-center">
                  <Icons.Video />
                  <p className="text-white font-black my-6 uppercase tracking-widest">{selectedFile.name}</p>
                  <audio src={selectedFile.url} className="w-full" controls autoPlay />
                </div>
              )}
           </div>
        </div>
      )}
      
      {/* GLOBAL TOAST */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in slide-in-from-top-4 ${toast.t === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

const ChatInput: React.FC<{ onSend: (t: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const handleSend = () => { if(text.trim() && !disabled) { onSend(text); setText(''); } };
  return (
    <div className={`flex-1 flex items-end gap-3 bg-[#0f0f12] border border-white/10 rounded-2xl p-3 focus-within:border-indigo-500/50 transition-all ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <textarea rows={1} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? "Muted" : "Poruka..."} className="flex-1 bg-transparent py-3 px-4 text-sm outline-none resize-none text-white placeholder:text-slate-700 font-medium" />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className={`p-4 rounded-xl transition-all shadow-lg active:scale-95 ${text.trim() && !disabled ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, time: number, expiresAt: number, onPreview: () => void }> = ({ file, sender, time, expiresAt, onPreview }) => {
  const [timeLeft, setTimeLeft] = useState(Math.round((expiresAt - Date.now()) / 1000 / 60));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000 / 60))), 30000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');

  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden shadow-xl group relative border-l-4 border-l-indigo-600 animate-in zoom-in-95">
      <div className="absolute top-3 right-3 z-10 bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-indigo-400/20">
        {timeLeft}m
      </div>
      <div className="cursor-pointer overflow-hidden aspect-video bg-black flex items-center justify-center relative" onClick={onPreview}>
         {isImg && <img src={file.url} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" />}
         {!isImg && !isVid && <div className="text-slate-700 scale-150"><Icons.File /></div>}
         <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] bg-black/60 px-4 py-2 rounded-full border border-white/10 shadow-2xl">Preview</span>
         </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
           <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter">{file.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-indigo-500 uppercase">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase truncate">by {sender}</span>
              </div>
           </div>
           <a href={file.url} download={file.name} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-white/5 active:scale-95"><Icons.Download /></a>
        </div>
      </div>
    </div>
  );
};
