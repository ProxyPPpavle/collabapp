
import React, { useState, useEffect, useRef } from 'react';
import { User, Group, Message, SharedFile, Reaction } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, CHAT_COLORS } from './constants';

const saveToStorage = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const getFromStorage = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Pomoćna funkcija za bezbedno čišćenje URL-a
const safeClearUrl = () => {
  try {
    const url = new URL(window.location.href);
    if (url.protocol !== 'blob:') {
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
    }
  } catch (e) {
    console.warn("History API is restricted in this environment:", e);
  }
};

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
      onAuth(newUser, roomToJoin || undefined);
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
          <p className="text-slate-500 text-sm mb-12 uppercase tracking-[0.3em] font-bold">Ephemeral Workspace</p>
          <div className="space-y-4">
            <button onClick={() => setMode('guest')} className="w-full bg-indigo-600 text-white py-5 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all">Create Fast Group</button>
            <button onClick={() => setMode('join-code')} className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-white/10 transition-all">Join with Code</button>
            <button onClick={() => setMode('login')} className="w-full text-indigo-400 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:text-white transition-all underline">Make an Account</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-md shadow-2xl">
        <h2 className="text-xl font-black text-white italic uppercase mb-8">
          {mode === 'join-link' || mode === 'join-code' ? 'Pridruži se Labu' : mode === 'guest' ? 'Postani Gost' : mode === 'login' ? 'Login' : 'Registracija'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'join-code' && (
            <input type="text" placeholder="Lab Code (npr. AB12XY)" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold uppercase" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
          )}
          {(mode === 'guest' || mode === 'join-link' || mode === 'join-code' || mode === 'signup') && (
            <input type="text" placeholder="Tvoje Ime..." required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white font-bold" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          {(mode === 'login' || mode === 'signup') && (
            <input type="text" placeholder="Email ili Username" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
          {(mode === 'guest' || mode === 'join-link' || mode === 'join-code') && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-3 px-1">Tvoja Boja Četa</label>
              <div className="flex gap-2">
                {CHAT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <input type="password" placeholder="Lozinka" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
            {mode === 'join-link' || mode === 'join-code' ? 'Join Now' : mode === 'guest' ? 'Započni Lab' : 'Potvrdi'}
          </button>
        </form>
        {(mode === 'join-link' || mode === 'join-code') && (
          <button onClick={() => setMode('login')} className="w-full mt-6 text-indigo-400 text-[10px] uppercase font-black tracking-widest hover:text-white transition-all underline">Or Login and Join</button>
        )}
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string, t: 'ok' | 'err' = 'ok') => {
    setToast({ m, t });
    setTimeout(() => setToast(null), 3000);
  };

  const isOnline = (u: User | string) => {
    const target = typeof u === 'string' ? allUsers.find(au => au.id === u) : u;
    return target?.lastSeen && (Date.now() - target.lastSeen < 12000);
  };

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const users: User[] = getFromStorage('cl_users') || [];
      const meIdx = users.findIndex(u => u.id === user.id);
      
      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      const currentActiveGroup = allGroups.find(g => g.id === activeGroupId);

      if (meIdx > -1) {
        users[meIdx].lastSeen = Date.now();
        if (currentActiveGroup?.inCall?.includes(user.id)) {
          users[meIdx].isSpeaking = Math.random() > 0.7;
        } else {
          users[meIdx].isSpeaking = false;
        }
        saveToStorage('cl_users', users);
        setAllUsers(users);
      } else if (user.isGuest) {
        setAllUsers(prev => {
          const others = prev.filter(p => p.id !== user.id);
          const updatedMe = { ...user, lastSeen: Date.now(), isSpeaking: currentActiveGroup?.inCall?.includes(user.id) ? Math.random() > 0.7 : false };
          return [...others, updatedMe];
        });
      }

      if (!allGroups.some(g => g.id === 'live-space')) {
        const liveSpace = { id: 'live-space', name: 'Live Space Hub', ownerId: 'system', members: [], createdAt: Date.now(), inCall: [] };
        saveToStorage('cl_groups', [...allGroups, liveSpace]);
      }
      setGroups(allGroups.filter(g => g.members.includes(user.id) || g.id === 'live-space'));

      if (activeGroupId) {
        const msgKey = `cl_msgs_${activeGroupId}`;
        const groupMsgs: Message[] = getFromStorage(msgKey) || [];
        const filtered = groupMsgs.filter(m => m.type === 'system' || isOnline(m.senderId));
        if (JSON.stringify(filtered) !== JSON.stringify(messages)) setMessages(filtered);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [user, activeGroupId, messages, allUsers]);

  const handleAuthSuccess = (u: User, autoGroupId?: string) => {
    setUser(u);
    if (autoGroupId) {
      const all = getFromStorage('cl_groups') || [];
      const gIdx = all.findIndex((g:any) => g.id === autoGroupId);
      if (gIdx > -1) {
        if (!all[gIdx].members.includes(u.id)) {
          all[gIdx].members = [...all[gIdx].members, u.id];
          saveToStorage('cl_groups', all);
          sendSystemMessage(autoGroupId, `${u.username} se pridružio labu.`);
        }
        setActiveGroupId(autoGroupId);
        safeClearUrl();
      } else {
        showToast("Soba nije pronađena.", 'err');
      }
    }
  };

  const sendSystemMessage = (groupId: string, text: string) => {
    const msgKey = `cl_msgs_${groupId}`;
    const existing = getFromStorage(msgKey) || [];
    const sysMsg: Message = { id: Math.random().toString(36).substring(2, 9), groupId, senderId: 'system', senderName: 'SYSTEM', text, type: 'system', timestamp: Date.now(), expiresAt: Date.now() + EXPIRY_DURATION };
    saveToStorage(msgKey, [...existing, sysMsg]);
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    if (activeGroupId === 'live-space' && Date.now() - lastSentTime < 2000) { showToast("Sačekaj 2s (Live Space Cooldown)", 'err'); return; }
    
    if (editingMessage) {
      const msgKey = `cl_msgs_${activeGroupId}`;
      const all = getFromStorage(msgKey) || [];
      const idx = all.findIndex((m:any) => m.id === editingMessage.id);
      if (idx > -1) {
        all[idx].text = text;
        all[idx].isEdited = true;
        saveToStorage(msgKey, all);
        setEditingMessage(null);
      }
      return;
    }

    let sharedFile;
    if (file) {
      const limit = user.isGuest ? PLAN_LIMITS.guest : PLAN_LIMITS[user.plan];
      if (file.size > limit) { showToast("Prevelik fajl za ovaj plan!", 'err'); return; }
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
      color: user.chatColor,
      replyToId: replyingTo?.id,
      reactions: []
    };
    const msgKey = `cl_msgs_${activeGroupId}`;
    saveToStorage(msgKey, [...(getFromStorage(msgKey) || []), newMessage]);
    setReplyingTo(null);
    setLastSentTime(Date.now());
  };

  const handleReaction = (msgId: string, emoji: string) => {
    const msgKey = `cl_msgs_${activeGroupId}`;
    const all = getFromStorage(msgKey) || [];
    const idx = all.findIndex((m:any) => m.id === msgId);
    if (idx > -1) {
      const reactions = all[idx].reactions || [];
      const reactIdx = reactions.findIndex((r:Reaction) => r.emoji === emoji);
      if (reactIdx > -1) {
        if (reactions[reactIdx].userIds.includes(user!.id)) {
          reactions[reactIdx].userIds = reactions[reactIdx].userIds.filter((id:string) => id !== user!.id);
        } else {
          reactions[reactIdx].userIds.push(user!.id);
        }
      } else {
        reactions.push({ emoji, userIds: [user!.id] });
      }
      all[idx].reactions = reactions.filter((r:Reaction) => r.userIds.length > 0);
      saveToStorage(msgKey, all);
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    const msgKey = `cl_msgs_${activeGroupId}`;
    const all = getFromStorage(msgKey) || [];
    saveToStorage(msgKey, all.filter((m:any) => m.id !== msgId));
    showToast("Poruka obrisana");
  };

  const handleCallAction = (action: 'join' | 'leave') => {
    if (!activeGroup) return;
    const all = getFromStorage('cl_groups') || [];
    const gIdx = all.findIndex((g:any) => g.id === activeGroupId);
    if (gIdx > -1) {
      all[gIdx].inCall = action === 'join' ? [...new Set([...(all[gIdx].inCall || []), user!.id])] : (all[gIdx].inCall || []).filter((id:string) => id !== user!.id);
      saveToStorage('cl_groups', all);
    }
  };

  const handleKickMember = (memberId: string) => {
    if (!activeGroup || activeGroup.ownerId !== user?.id) return;
    const all = getFromStorage('cl_groups') || [];
    const gIdx = all.findIndex((g:any) => g.id === activeGroupId);
    if (gIdx > -1) {
      all[gIdx].members = all[gIdx].members.filter((id:string) => id !== memberId);
      saveToStorage('cl_groups', all);
      sendSystemMessage(activeGroupId, `Korisnik je izbačen.`);
      showToast("Korisnik izbačen");
    }
  };

  // Fix: Implemented handleCreateGroup to fix the reference error on line 543
  const handleCreateGroup = () => {
    if (!newGroupName.trim() || !user) return;
    const groupId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newG: Group = {
      id: groupId,
      name: newGroupName,
      ownerId: user.id,
      members: [user.id],
      createdAt: Date.now(),
      inCall: []
    };
    const all = getFromStorage('cl_groups') || [];
    const updated = [...all, newG];
    saveToStorage('cl_groups', updated);
    setGroups(updated.filter(g => g.members.includes(user.id) || g.id === 'live-space'));
    setActiveGroupId(groupId);
    sendSystemMessage(groupId, `${user.username} je kreirao lab.`);
    setNewGroupName('');
    showToast("Lab kreiran!");
  };

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const usersInCall = allUsers.filter(u => activeGroup?.inCall?.includes(u.id) ?? false);

  if (!user) return <AuthPage onAuth={handleAuthSuccess} />;

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-[320px] bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-indigo-400 italic">COLAB LAB</span>
          {!user.isGuest && <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><Icons.Plus /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <button onClick={() => setActiveGroupId('live-space')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${activeGroupId === 'live-space' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-lg' : 'hover:bg-white/5 border-transparent opacity-60'}`}>
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-[11px] font-black uppercase tracking-widest italic">Live Space</span>
          </button>
          <div className="h-px bg-white/5 my-4 mx-2"></div>
          {groups.filter(g => g.id !== 'live-space').map(g => (
            <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-md' : 'hover:bg-white/5 border-transparent'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
              <span className="text-[11px] font-black truncate uppercase tracking-tighter">{g.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5 bg-black/40">
           <div className="flex items-center gap-3">
             <button onClick={() => setShowProfile(true)} className="relative group shrink-0">
               <img src={user.avatar} className="w-10 h-10 rounded-xl border border-white/10" />
               <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 rounded-xl transition-all flex items-center justify-center text-[7px] font-black">EDIT</div>
             </button>
             <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate italic uppercase">{user.username}</p>
                <p className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.2em]">{user.plan}</p>
             </div>
             <button onClick={() => setUser(null)} className="text-slate-600 hover:text-rose-500 p-2"><Icons.LogOut /></button>
           </div>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 flex flex-col bg-[#050505] relative">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-10">
             <Icons.Sparkles />
             <h2 className="text-sm font-black uppercase tracking-[0.4em] mt-6 italic">Select Workspace</h2>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0 z-20">
               <div className="flex items-center gap-6">
                  <div>
                    <h2 className="font-black text-lg text-white italic uppercase tracking-tighter">{activeGroup.name}</h2>
                    {activeGroup.id !== 'live-space' && <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Lab ID: {activeGroup.id}</span>}
                  </div>
                  {activeGroup.id !== 'live-space' && (
                    <button onClick={() => {
                      try {
                        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?room=${activeGroup.id}`);
                        showToast("Link kopiran!");
                      } catch (e) {
                        showToast("Kopiranje koda: " + activeGroup.id);
                      }
                    }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all text-[9px] font-black uppercase tracking-widest border border-indigo-500/10">
                      <Icons.Copy /> Copy Link
                    </button>
                  )}
                  {activeGroup.id === 'live-space' && (
                    <div className="flex bg-white/5 p-1 rounded-xl">
                      <button onClick={() => setLiveTab('chat')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${liveTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Live Chat</button>
                      <button onClick={() => setLiveTab('ask')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${liveTab === 'ask' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Ask Everyone</button>
                    </div>
                  )}
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {allUsers.filter(u => activeGroup.members.includes(u.id)).slice(0, 4).map(m => (
                      <img key={m.id} src={m.avatar} onClick={() => setViewedUser(m)} className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer hover:z-10 ${m.isSpeaking ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' : 'border-[#050505]'}`} />
                    ))}
                  </div>
                  <button onClick={() => setShowAbout(true)} className="text-[9px] bg-white/5 px-4 py-2 rounded-lg uppercase font-black tracking-widest hover:bg-indigo-600 transition-all">About</button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-white/5 relative">
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {liveTab === 'ask' && activeGroup.id === 'live-space' ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center italic">
                      <Icons.Sparkles />
                      <p className="mt-4 text-[10px] uppercase font-black tracking-widest">Ask Everyone Mod - Coming Soon</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      msg.type === 'system' ? (
                        <div key={msg.id} className="text-center py-2"><span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">{msg.text}</span></div>
                      ) : (
                        <MessageComponent key={msg.id} msg={msg} me={user!} onReply={() => setReplyingTo(msg)} onReact={handleReaction} onDelete={() => handleDeleteMessage(msg.id)} onEdit={() => setEditingMessage(msg)} isOwner={activeGroup.ownerId === user.id} />
                      )
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-6 border-t border-white/5 flex flex-col gap-3">
                  {replyingTo && (
                    <div className="bg-white/5 p-3 rounded-xl flex items-center justify-between border-l-4 border-indigo-600 animate-in slide-in-from-bottom-2">
                       <div className="min-w-0">
                         <span className="text-[8px] font-black uppercase text-indigo-400">Reply to {replyingTo.senderName}</span>
                         <p className="text-[10px] truncate opacity-50">{replyingTo.text}</p>
                       </div>
                       <button onClick={() => setReplyingTo(null)} className="text-slate-600 hover:text-white p-1"><Icons.X /></button>
                    </div>
                  )}
                  {editingMessage && (
                    <div className="bg-indigo-600/10 p-3 rounded-xl flex items-center justify-between border-l-4 border-emerald-600 animate-in slide-in-from-bottom-2">
                       <span className="text-[8px] font-black uppercase text-emerald-400">Editing Message...</span>
                       <button onClick={() => setEditingMessage(null)} className="text-slate-600 hover:text-white p-1"><Icons.X /></button>
                    </div>
                  )}
                  <div className="flex gap-4 items-center">
                    <button onClick={() => handleCallAction(activeGroup.inCall?.includes(user.id) ? 'leave' : 'join')} className={`p-4 rounded-xl transition-all ${activeGroup.inCall?.includes(user.id) ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/20 animate-pulse' : 'bg-white/5 text-indigo-500 hover:bg-white/10'}`}>
                      <Icons.Phone />
                    </button>
                    <ChatInput onSend={handleSendMessage} disabled={activeGroup.mutedMembers?.includes(user.id)} initialValue={editingMessage?.text} />
                  </div>
                </div>
              </div>

              {/* ASSETS & CALL LAB */}
              <div className="w-[380px] bg-[#0a0a0c] flex flex-col shrink-0">
                <div className="p-6 border-b border-white/5 bg-indigo-600/5">
                   <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">CALL LAB</span>
                      <span className="text-[8px] font-bold text-slate-600 uppercase">{usersInCall.length} Active</span>
                   </div>
                   <div className="space-y-3">
                      {usersInCall.map(u => (
                        <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl transition-all ${u.isSpeaking ? 'bg-emerald-600/10 border border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-white/5 border border-transparent'}`}>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={u.avatar} className={`w-8 h-8 rounded-lg transition-all ${u.isSpeaking ? 'scale-110 shadow-lg' : ''}`} />
                              {u.isSpeaking && <div className="absolute inset-0 rounded-lg border-2 border-emerald-500 animate-ping opacity-20"></div>}
                            </div>
                            <span className="text-[10px] font-black uppercase text-white tracking-tighter italic">{u.username}</span>
                          </div>
                          {u.isSpeaking && <div className="flex gap-0.5"><div className="w-0.5 h-3 bg-emerald-500 animate-bounce"></div><div className="w-0.5 h-3 bg-emerald-500 animate-bounce delay-75"></div><div className="w-0.5 h-3 bg-emerald-500 animate-bounce delay-150"></div></div>}
                        </div>
                      ))}
                      {usersInCall.length === 0 && <p className="text-[9px] text-slate-700 italic font-bold text-center py-4">Lab is quiet...</p>}
                   </div>
                </div>
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">ASSET LAB</span>
                  <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                  <label htmlFor="lab-up" className="p-3 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-500 transition-all active:scale-95"><Icons.Paperclip /></label>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                   {messages.filter(m => m.type === 'file').map(msg => (
                    <FileItem key={msg.id} file={msg.file!} sender={msg.senderName} expiresAt={msg.expiresAt} onPreview={() => setSelectedFile(msg.file!)} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showAbout && activeGroup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-sm p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8">
                 <h3 className="font-black italic text-xl uppercase tracking-tighter text-white">Lab Members</h3>
                 <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-white/5 rounded-lg"><Icons.X /></button>
              </div>
              <div className="space-y-3">
                {allUsers.filter(u => activeGroup.members.includes(u.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} className="w-8 h-8 rounded-lg" />
                      <span className="text-[11px] font-black uppercase text-white tracking-tighter italic">{m.username}</span>
                      {m.id === activeGroup.ownerId && <span className="text-[7px] bg-indigo-600 text-white px-1.5 rounded uppercase font-bold">Owner</span>}
                    </div>
                    {activeGroup.ownerId === user.id && m.id !== user.id && (
                      <button onClick={() => handleKickMember(m.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Icons.Hammer /></button>
                    )}
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-6" onClick={() => setShowCreateGroup(false)}>
           <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-8 text-center">Novi Lab</h3>
              <input type="text" placeholder="Ime sobe..." className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-emerald-500 outline-none text-white font-bold mb-4" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <button onClick={() => { handleCreateGroup(); setShowCreateGroup(false); }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition-all">Kreiraj</button>
           </div>
        </div>
      )}

      {showProfile && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
          <div className="bg-[#0f0f12] border border-indigo-500/30 rounded-2xl w-full max-w-sm p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-4 italic">Boja Četa</label>
            <div className="grid grid-cols-7 gap-2 mb-10">
              {CHAT_COLORS.map(c => (
                <button key={c} onClick={() => {
                   const users = getFromStorage('cl_users') || [];
                   const me = users.find((u:any) => u.id === user.id);
                   if(me) { me.chatColor = c; saveToStorage('cl_users', users); setUser({...me}); }
                }} className={`w-full aspect-square rounded-lg transition-all ${user.chatColor === c ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <button onClick={() => setShowProfile(false)} className="w-full py-4 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest hover:text-white transition-all">Zatvori</button>
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
                  <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-6"><Icons.Video /></div>
                  <p className="text-white font-black my-6 uppercase tracking-widest italic">{selectedFile.name}</p>
                  <audio src={selectedFile.url} className="w-full" controls autoPlay />
                </div>
              )}
           </div>
        </div>
      )}
      
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in slide-in-from-top-4 ${toast.t === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.m}
        </div>
      )}
    </div>
  );
}

const MessageComponent = ({ msg, me, onReply, onReact, onDelete, onEdit, isOwner }: any) => {
  const [showMenu, setShowMenu] = useState(false);
  const msgKey = `cl_msgs_${msg.groupId}`;
  const allMessages: Message[] = getFromStorage(msgKey) || [];
  const repliedTo = msg.replyToId ? allMessages.find(m => m.id === msg.replyToId) : null;

  return (
    <div className={`flex gap-4 group/msg ${msg.senderId === me.id ? 'flex-row-reverse' : ''}`} onClick={() => setShowMenu(!showMenu)}>
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-9 h-9 rounded-lg bg-black shrink-0 border border-white/10" />
      <div className={`flex flex-col max-w-[70%] relative ${msg.senderId === me.id ? 'items-end' : ''}`}>
        <span className="text-[9px] font-black uppercase tracking-widest mb-1.5 px-1 flex gap-2 italic" style={{ color: msg.color || '#6366f1' }}>
          {msg.senderName} {msg.isEdited && <span className="opacity-30 italic">(Edited)</span>}
        </span>
        
        {repliedTo && (
          <div className="mb-2 p-2 bg-white/5 border-l-2 border-white/10 rounded-lg text-[10px] opacity-40 italic max-w-full truncate">
            {repliedTo.text}
          </div>
        )}

        <div className={`p-4 rounded-2xl text-sm leading-relaxed transition-all relative ${msg.senderId === me.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#121216] border border-white/5 text-slate-200 rounded-tl-none'} ${showMenu ? 'ring-2 ring-white/20' : ''}`}>
          {msg.text}
        </div>

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {msg.reactions.map((r: Reaction) => (
              <button key={r.emoji} onClick={(e) => { e.stopPropagation(); onReact(msg.id, r.emoji); }} className={`px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 flex items-center gap-1 transition-all ${r.userIds.includes(me.id) ? 'bg-indigo-600 text-white border-indigo-400' : ''}`}>
                <span>{r.emoji}</span> <span className="font-bold opacity-60">{r.userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Bar */}
        {showMenu && (
          <div className={`absolute -top-10 flex items-center bg-[#1a1a20] border border-white/10 rounded-xl p-1 gap-1 shadow-2xl z-10 animate-in zoom-in-95 ${msg.senderId === me.id ? 'right-0' : 'left-0'}`}>
            {['🔥', '👍', '❤️', '😂', '😮'].map(e => (
              <button key={e} onClick={(e_sub) => { e_sub.stopPropagation(); onReact(msg.id, e); setShowMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-xs transition-all active:scale-125">{e}</button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onReply(); setShowMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-indigo-400 transition-all" title="Reply"><Icons.Reply /></button>
            {msg.senderId === me.id && <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-emerald-400 transition-all" title="Edit"><Icons.Edit /></button>}
            {(msg.senderId === me.id || isOwner) && <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }} className="p-2 hover:bg-white/10 rounded-lg text-rose-500 transition-all" title="Delete"><Icons.Trash /></button>}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInput: React.FC<{ onSend: (t: string) => void; disabled?: boolean; initialValue?: string }> = ({ onSend, disabled, initialValue = '' }) => {
  const [text, setText] = useState(initialValue);
  useEffect(() => setText(initialValue), [initialValue]);
  const handleSend = () => { if(text.trim() && !disabled) { onSend(text); setText(''); } };
  return (
    <div className={`flex-1 flex items-end gap-3 bg-[#0f0f12] border border-white/10 rounded-2xl p-3 focus-within:border-indigo-500/50 transition-all ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <textarea rows={1} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? "Muted" : "Pošalji poruku..."} className="flex-1 bg-transparent py-3 px-4 text-sm outline-none resize-none text-white placeholder:text-slate-700 font-medium" />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className={`p-4 rounded-xl transition-all shadow-lg active:scale-95 ${text.trim() && !disabled ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, expiresAt: number, onPreview: () => void }> = ({ file, sender, expiresAt, onPreview }) => {
  const [timeLeft, setTimeLeft] = useState(Math.round((expiresAt - Date.now()) / 1000 / 60));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000 / 60))), 30000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const isImg = file.type.startsWith('image/');

  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden shadow-xl group relative border-l-4 border-l-indigo-600 animate-in zoom-in-95">
      <div className="absolute top-3 right-3 z-10 bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-indigo-400/20">
        {timeLeft}m left
      </div>
      <div className="cursor-pointer overflow-hidden aspect-video bg-black flex items-center justify-center relative" onClick={onPreview}>
         {isImg && <img src={file.url} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" />}
         {!isImg && <div className="text-slate-700 scale-150"><Icons.File /></div>}
         <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] bg-black/60 px-4 py-2 rounded-full border border-white/10 shadow-2xl">Preview</span>
         </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
           <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter italic">{file.name}</p>
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
