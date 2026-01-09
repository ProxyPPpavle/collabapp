
import React, { useState, useEffect, useRef } from 'react';
import { User, Group, Message, SharedFile, FriendRequest, GroupInvite } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons, AVATAR_OPTIONS } from './constants';

const saveToStorage = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const getFromStorage = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

const AuthPage: React.FC<{ onAuth: (user: User) => void }> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users: User[] = getFromStorage('cl_users') || [];
    if (isLogin) {
      const user = users.find((u) => u.email === email || u.username === email);
      if (user) {
        ensureMySpace(user);
        onAuth(user);
      } else alert('Korisnik nije pronađen');
    } else {
      if (users.some(u => u.username === username)) {
        alert("Korisničko ime zauzeto!");
        return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substring(2, 9),
        email,
        username,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        plan: 'free',
        friends: []
      };
      users.push(newUser);
      saveToStorage('cl_users', users);
      ensureMySpace(newUser);
      onAuth(newUser);
    }
  };

  const ensureMySpace = (user: User) => {
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    if (!allGroups.some(g => g.ownerId === user.id && g.name === 'My Space')) {
      const mySpace: Group = {
        id: `myspace-${user.id}`,
        name: 'My Space',
        ownerId: user.id,
        members: [user.id],
        createdAt: Date.now()
      };
      saveToStorage('cl_groups', [...allGroups, mySpace]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
            <Icons.Video />
          </div>
          <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">Collab Lab</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input type="text" placeholder="Username" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white text-sm" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          <input type="text" placeholder="Email ili Username" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Lozinka" required className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-indigo-500 outline-none text-white text-sm" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all">{isLogin ? 'Log In' : 'Sign Up'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-slate-500 text-xs font-bold uppercase tracking-widest">{isLogin ? "Registruj se" : 'Prijavi se'}</button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPlans, setShowPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [toast, setToast] = useState<{ m: string; t: 'ok' | 'err' } | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  
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
      if (meIdx > -1) {
        const updatedMe = users[meIdx];
        updatedMe.lastSeen = Date.now();
        saveToStorage('cl_users', users);
        setAllUsers(users);
        if (JSON.stringify(updatedMe.friends) !== JSON.stringify(user.friends)) {
          setUser({...updatedMe});
        }
      }

      const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
      setFriendRequests(reqs.filter(r => r.toId === user.id));
      
      const invites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
      setGroupInvites(invites.filter(i => i.toId === user.id));

      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      setGroups(allGroups.filter(g => g.members.includes(user.id)));

      if (activeGroupId) {
        const msgKey = `cl_msgs_${activeGroupId}`;
        const groupMsgs: Message[] = getFromStorage(msgKey) || [];
        const validMsgs = groupMsgs.filter(m => m.expiresAt > Date.now());
        
        // Custom rule: Sakrij fajlove čiji je pošiljalac offline
        const filteredMsgs = validMsgs.filter(m => {
          if (m.type === 'file') {
             return isOnline(m.senderId);
          }
          return true;
        });

        if (JSON.stringify(filteredMsgs) !== JSON.stringify(messages)) {
          setMessages(filteredMsgs);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [user, activeGroupId, messages, allUsers]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendFriendRequest = () => {
    if (!user || !searchQuery) return;
    const target = allUsers.find(u => u.username === searchQuery);
    if (!target) { showToast("Korisnik nije pronađen.", 'err'); return; }
    if (target.id === user.id) return;
    const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    if (reqs.some(r => r.fromId === user.id && r.toId === target.id)) {
      showToast("Već poslat zahtev!", 'err'); return;
    }
    const newReq = { id: Math.random().toString(36).substring(2), fromId: user.id, fromUsername: user.username, toId: target.id, timestamp: Date.now() };
    saveToStorage('cl_reqs', [...reqs, newReq]);
    showToast("Zahtev poslat!");
    setSearchQuery('');
  };

  const handleAcceptRequest = (req: FriendRequest) => {
    const users: User[] = getFromStorage('cl_users') || [];
    const me = users.find(u => u.id === user!.id);
    const him = users.find(u => u.id === req.fromId);
    if (me && him) {
      me.friends = [...new Set([...me.friends, him.id])];
      him.friends = [...new Set([...him.friends, me.id])];
      saveToStorage('cl_users', users);
      setUser({...me});
    }
    const allReqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    saveToStorage('cl_reqs', allReqs.filter(r => r.id !== req.id));
    showToast("Prijatelj dodat!");
  };

  const handleAcceptInvite = (inv: GroupInvite) => {
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    const gIdx = allGroups.findIndex(g => g.id === inv.groupId);
    if (gIdx > -1) {
      allGroups[gIdx].members = [...new Set([...allGroups[gIdx].members, user!.id])];
      saveToStorage('cl_groups', allGroups);
    }
    const allInvites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
    saveToStorage('cl_group_invites', allInvites.filter(i => i.id !== inv.id));
    setActiveGroupId(inv.groupId);
    showToast("Ušao u lab sobu!");
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newG: Group = { id: Math.random().toString(36).substring(2,9), name: newGroupName, ownerId: user!.id, members: [user!.id], createdAt: Date.now(), mutedMembers: [] };
    const all = getFromStorage('cl_groups') || [];
    saveToStorage('cl_groups', [...all, newG]);
    setNewGroupName('');
    setShowCreateGroup(false);
    setActiveGroupId(newG.id);
    showToast("Soba kreirana!");
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    const group = groups.find(g => g.id === activeGroupId);
    if (group?.mutedMembers?.includes(user.id)) {
      showToast("Mutiran si u ovoj sobi!", 'err'); return;
    }
    
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) { showToast("Prevelik fajl za tvoj plan!", 'err'); return; }
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
      expiresAt: Date.now() + EXPIRY_DURATION
    };
    const msgKey = `cl_msgs_${activeGroupId}`;
    const existing = getFromStorage(msgKey) || [];
    saveToStorage(msgKey, [...existing, newMessage]);
    setMessages([...existing, newMessage]);
    if(file) showToast("Fajl poslat!");
  };

  const handleKickMember = (memberId: string) => {
    if (!activeGroup || activeGroup.ownerId !== user?.id) return;
    if (memberId === user.id) return;
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    const gIdx = allGroups.findIndex(g => g.id === activeGroupId);
    if (gIdx > -1) {
      allGroups[gIdx].members = allGroups[gIdx].members.filter(id => id !== memberId);
      saveToStorage('cl_groups', allGroups);
      showToast("Korisnik izbačen!");
    }
  };

  const handleMuteMember = (memberId: string) => {
    if (!activeGroup || activeGroup.ownerId !== user?.id) return;
    if (memberId === user.id) return;
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    const gIdx = allGroups.findIndex(g => g.id === activeGroupId);
    if (gIdx > -1) {
      const muted = allGroups[gIdx].mutedMembers || [];
      if (muted.includes(memberId)) {
        allGroups[gIdx].mutedMembers = muted.filter(id => id !== memberId);
        showToast("Korisnik odmutiran!");
      } else {
        allGroups[gIdx].mutedMembers = [...muted, memberId];
        showToast("Korisnik mutiran!");
      }
      saveToStorage('cl_groups', allGroups);
    }
  };

  const updateAvatar = (seed: string) => {
    if(!user) return;
    const users = getFromStorage('cl_users') || [];
    const meIdx = users.findIndex((u:any) => u.id === user.id);
    if(meIdx > -1) {
      users[meIdx].avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
      saveToStorage('cl_users', users);
      setUser({...users[meIdx]});
      showToast("Profilna promenjena!");
    }
  };

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const friendsList = allUsers.filter(u => user.friends.includes(u.id));
  const activeMembers = allUsers.filter(u => activeGroup?.members?.includes(u.id) ?? false);

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden relative">
      
      {/* GLOBAL TOAST */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl animate-in slide-in-from-top-4 ${toast.t === 'err' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.m}
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-[440px] bg-[#0f0f12] border-r border-white/5 flex shrink-0 shadow-2xl z-30">
        <div className="w-1/2 border-r border-white/5 flex flex-col h-full bg-[#0d0d0f]">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <span className="font-black text-[10px] uppercase tracking-widest text-indigo-400">Prijatelji</span>
            <button onClick={() => setShowInbox(!showInbox)} className={`p-2 rounded-lg transition-all ${showInbox ? 'bg-indigo-600 text-white scale-110 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 text-slate-500 hover:text-white'}`}>
              <Icons.Mail />
              {(friendRequests.length > 0 || groupInvites.length > 0) && (
                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0d0d0f] animate-ping"></div>
              )}
            </button>
          </div>
          <div className="p-4 border-b border-white/5 shrink-0">
            <div className="flex gap-2">
              <input type="text" placeholder="Username..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button onClick={handleSendFriendRequest} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:scale-95 transition-all"><Icons.UserPlus /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {friendsList.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer" onClick={() => setViewedUser(f)}>
                <div className="relative">
                  <img src={f.avatar} className="w-9 h-9 rounded-lg border border-white/10 bg-black" />
                  {isOnline(f) && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0d0d0f]"></div>}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-black text-slate-200 truncate">{f.username}</span>
                  <span className="text-[8px] text-slate-600 font-black uppercase">{isOnline(f) ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-1/2 flex flex-col h-full bg-[#0a0a0c]">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <span className="font-black text-[10px] uppercase tracking-widest text-emerald-400">Lab Sobe</span>
            <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><Icons.Plus /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {groups.sort((a,b) => a.name === 'My Space' ? -1 : 1).map(g => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all border ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-xl' : 'hover:bg-white/5 border-transparent'}`}>
                <div className={`w-2 h-2 rounded-full ${g.name === 'My Space' ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`}></div>
                <span className="text-[11px] font-black truncate uppercase tracking-tighter">{g.name}</span>
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-white/5 bg-black/40">
             <div className="flex items-center gap-3">
               <button onClick={() => setShowProfile(true)} className="relative group shrink-0">
                 <img src={user.avatar} className="w-10 h-10 rounded-xl border border-white/10 group-hover:border-indigo-500 transition-all" />
                 <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 rounded-xl transition-all flex items-center justify-center text-[10px] font-black">EDIT</div>
               </button>
               <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white truncate italic uppercase">{user.username}</p>
                  <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{user.plan} lab</p>
               </div>
               <button onClick={() => setUser(null)} className="text-slate-600 hover:text-rose-500 p-2 shrink-0"><Icons.LogOut /></button>
             </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20">
             <div className="w-20 h-20 bg-indigo-600/10 text-indigo-500 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20 animate-pulse">
               <Icons.Sparkles />
             </div>
             <h2 className="text-xl font-black italic uppercase tracking-widest">Odaberi Workspace</h2>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0">
               <div className="flex items-center gap-6">
                  <div>
                    <h2 className="font-black text-lg text-white italic uppercase tracking-tighter">{activeGroup.name}</h2>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">Session Active</span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
                  <div className="flex -space-x-2">
                    {activeMembers.slice(0, 5).map(m => (
                      <img key={m.id} src={m.avatar} onClick={() => setViewedUser(m)} className="w-8 h-8 rounded-lg border-2 border-[#050505] bg-black cursor-pointer hover:scale-110 transition-transform" />
                    ))}
                  </div>
                  <button onClick={() => setShowAbout(true)} className="text-[9px] bg-white/5 px-4 py-2 rounded-lg uppercase font-black tracking-widest hover:bg-indigo-600 transition-all">Members & Tools</button>
               </div>
               <div className="flex items-center gap-4">
                  {activeGroup.ownerId === user.id && activeGroup.name !== 'My Space' && (
                    <button onClick={() => setShowInviteMenu(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Invite</button>
                  )}
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-white/5">
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {messages.filter(m => m.type === 'text').map(msg => (
                    <div key={msg.id} className={`flex gap-4 ${msg.senderId === user.id ? 'flex-row-reverse' : ''}`}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} onClick={() => setViewedUser(allUsers.find(au => au.id === msg.senderId) || null)} className="w-9 h-9 rounded-lg bg-black shrink-0 border border-white/10 cursor-pointer hover:scale-105 transition-transform" />
                      <div className={`flex flex-col max-w-[70%] ${msg.senderId === user.id ? 'items-end' : ''}`}>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">{msg.senderName}</span>
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#121216] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-6 border-t border-white/5">
                  <ChatInput onSend={handleSendMessage} disabled={activeGroup.mutedMembers?.includes(user.id)} />
                </div>
              </div>

              <div className="w-[360px] bg-[#0a0a0c] flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Asset Lab</span>
                    <span className="text-[8px] font-black text-rose-500 uppercase animate-pulse">Auto-delete 1H</span>
                  </div>
                  <input type="file" id="lab-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                  <label htmlFor="lab-up" className="p-3 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-500 transition-all"><Icons.Paperclip /></label>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {messages.filter(m => m.type === 'file').map(msg => (
                    <FileItem key={msg.id} file={msg.file!} sender={msg.senderName} time={msg.timestamp} expiresAt={msg.expiresAt} onPreview={() => setSelectedFile(msg.file!)} />
                  ))}
                  {messages.filter(m => m.type === 'file').length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10">
                       <Icons.File />
                       <p className="text-[10px] uppercase font-black tracking-widest mt-4">Nema fajlova</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}

      {/* PROFILE VIEW (CLICK ON AVATAR) */}
      {viewedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-6" onClick={() => setViewedUser(null)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-sm p-10 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-8">
                <img src={viewedUser.avatar} className="w-24 h-24 rounded-2xl mx-auto border-4 border-white/5 mb-4 shadow-2xl bg-black" />
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{viewedUser.username}</h3>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline(viewedUser) ? 'text-emerald-500' : 'text-slate-500'}`}>{isOnline(viewedUser) ? 'Online' : 'Offline'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-xl text-center">
                    <p className="text-lg font-black text-white">{viewedUser.friends?.length || 0}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Prijatelja</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl text-center">
                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{viewedUser.plan} account</p>
                  </div>
              </div>
              
              {activeGroup?.ownerId === user.id && viewedUser.id !== user.id && (
                <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
                  <button onClick={() => { handleMuteMember(viewedUser.id); setViewedUser(null); }} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${activeGroup.mutedMembers?.includes(viewedUser.id) ? 'bg-amber-600 text-white' : 'bg-white/5 text-amber-500 hover:bg-amber-500 hover:text-white'}`}>
                    <Icons.X /> Mute
                  </button>
                  <button onClick={() => { handleKickMember(viewedUser.id); setViewedUser(null); }} className="flex items-center justify-center gap-2 py-3 bg-white/5 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-black uppercase text-[10px] transition-all">
                    <Icons.Hammer /> Kick
                  </button>
                </div>
              )}
              <button onClick={() => setViewedUser(null)} className="w-full mt-6 py-3 bg-white/5 text-slate-500 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10">Zatvori</button>
           </div>
        </div>
      )}

      {/* MY PROFILE (TAB) */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={() => setShowProfile(false)}>
           <div className="bg-[#0f0f12] border border-indigo-500/30 rounded-2xl w-full max-w-sm p-10 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
              <div className="text-center mb-10">
                <img src={user.avatar} className="w-24 h-24 rounded-2xl mx-auto border-4 border-white/5 mb-6 shadow-2xl bg-black" />
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">My Profile</h3>
              </div>
              <div className="space-y-6">
                <div>
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-4 px-1">Izaberi karakter:</label>
                   <div className="flex justify-between gap-2">
                     {AVATAR_OPTIONS.map(opt => (
                       <button key={opt.seed} onClick={() => updateAvatar(opt.seed)} className={`w-12 h-12 rounded-xl border-2 overflow-hidden transition-all ${user.avatar.includes(opt.seed) ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent hover:border-white/20'}`}>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opt.seed}`} className="w-full h-full bg-black" />
                       </button>
                     ))}
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl text-center border border-white/5">
                    <p className="text-lg font-black text-white">{user.friends.length}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Prijatelja</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl text-center border border-white/5">
                    <p className="text-lg font-black text-white">{groups.length}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Lab Soba</p>
                  </div>
                </div>
                <button onClick={() => setShowPlans(true)} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Plan: {user.plan}</button>
              </div>
           </div>
        </div>
      )}

      {/* ABOUT MODAL (MEMBERS LIST) */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-sm p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-10">
                 <h3 className="font-black italic text-xl uppercase tracking-tighter text-white">Lab Members</h3>
                 <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-white/5 rounded-lg"><Icons.X /></button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {activeMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5 cursor-pointer" onClick={() => setViewedUser(m)}>
                     <div className="flex items-center gap-3">
                        <img src={m.avatar} className="w-10 h-10 rounded-lg border border-white/10 bg-black" />
                        <div className="flex flex-col">
                           <span className="text-[12px] font-black text-slate-200">{m.username} {m.id === activeGroup?.ownerId && '👑'}</span>
                           <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline(m) ? 'text-emerald-500' : 'text-slate-700'}`}>{isOnline(m) ? 'Online' : 'Offline'}</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {activeGroup?.mutedMembers?.includes(m.id) && <div className="text-amber-500"><Icons.VolumeX /></div>}
                        <div className={`w-2 h-2 rounded-full ${isOnline(m) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* OTHER MODALS: CREATE GROUP, INBOX, FILE PREVIEW, PLANS */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[500] flex items-center justify-center p-6" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-[#0f0f12] border border-white/10 p-10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-8 text-center">Nova Soba</h3>
             <div className="space-y-4">
               <input type="text" placeholder="Ime grupe..." className="w-full bg-[#16161a] border border-white/10 px-5 py-4 rounded-xl focus:border-emerald-500 outline-none text-white font-bold" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateGroup()} />
               <button onClick={handleCreateGroup} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">Create Workspace</button>
             </div>
          </div>
        </div>
      )}

      {showInbox && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setShowInbox(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-sm p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8">
                 <h3 className="font-black italic text-xl uppercase tracking-tighter text-white">Inbox</h3>
                 <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-white/5 rounded-lg"><Icons.X /></button>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                 {friendRequests.length === 0 && groupInvites.length === 0 && <p className="text-center py-10 opacity-20 text-[10px] uppercase font-black italic">Sve čisto.</p>}
                 {friendRequests.map(req => (
                   <div key={req.id} className="bg-indigo-600/5 border border-indigo-500/20 p-4 rounded-xl space-y-3">
                     <p className="text-[11px] font-bold"><span className="text-indigo-400">{req.fromUsername}</span> ti šalje zahtev!</p>
                     <div className="flex gap-2">
                       <button onClick={() => handleAcceptRequest(req)} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Prihvati</button>
                       <button onClick={() => {
                          const all = getFromStorage('cl_reqs') || [];
                          saveToStorage('cl_reqs', all.filter((r:any) => r.id !== req.id));
                       }} className="p-2 bg-white/5 rounded-lg text-slate-500 hover:text-rose-500"><Icons.X /></button>
                     </div>
                   </div>
                 ))}
                 {groupInvites.map(inv => (
                   <div key={inv.id} className="bg-emerald-600/5 border border-emerald-500/20 p-4 rounded-xl space-y-3">
                     <p className="text-[11px] font-bold">Pozvan si u <span className="text-emerald-400">{inv.groupName}</span>!</p>
                     <button onClick={() => handleAcceptInvite(inv)} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest italic">Uđi u Lab</button>
                   </div>
                 ))}
              </div>
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
                  <div className="mb-6"><Icons.Video /></div>
                  <p className="text-white font-black mb-6 uppercase tracking-widest">{selectedFile.name}</p>
                  <audio src={selectedFile.url} className="w-full" controls autoPlay />
                </div>
              )}
              {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/') && !selectedFile.type.startsWith('audio/') && (
                <div className="bg-[#121216] p-20 rounded-2xl text-center">
                  <div className="mb-6 scale-150"><Icons.File /></div>
                  <p className="text-white font-black uppercase mb-8">{selectedFile.name}</p>
                  <a href={selectedFile.url} download={selectedFile.name} className="bg-indigo-600 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500">Download File</a>
                </div>
              )}
           </div>
           <div className="mt-8 text-center">
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Lab Preview Mod</p>
           </div>
        </div>
      )}

      {showPlans && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[600] flex items-center justify-center p-6" onClick={() => setShowPlans(false)}>
          <div className="bg-[#0f0f12] border border-white/5 rounded-3xl w-full max-w-4xl p-16 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-16">
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Lab Upgrade</h3>
              <button onClick={() => setShowPlans(false)} className="p-4 hover:bg-white/5 rounded-xl"><Icons.X /></button>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <PlanCard title="Free" price="0" limit="10MB" current={user.plan === 'free'} onSelect={() => setUser({...user, plan: 'free'})} />
              <PlanCard title="Pro" price="9" limit="30MB" highlight current={user.plan === 'pro'} onSelect={() => setUser({...user, plan: 'pro'})} />
              <PlanCard title="Premium" price="19" limit="100MB" current={user.plan === 'premium'} onSelect={() => setUser({...user, plan: 'premium'})} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ChatInput: React.FC<{ onSend: (t: string) => void; disabled?: boolean }> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const handleSend = () => { if(text.trim() && !disabled) { onSend(text); setText(''); } };
  return (
    <div className={`flex items-end gap-3 bg-[#0f0f12] border border-white/10 rounded-2xl p-3 focus-within:border-indigo-500/50 transition-all ${disabled ? 'opacity-50 grayscale' : ''}`}>
      <textarea rows={1} value={text} disabled={disabled} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={disabled ? "Mutiran si u ovoj sobi..." : "Pošalji poruku..."} className="flex-1 bg-transparent py-3 px-4 text-sm outline-none resize-none text-white placeholder:text-slate-700 font-medium" />
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
  const isAud = file.type.startsWith('audio/');

  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl overflow-hidden shadow-xl group relative border-l-4 border-l-indigo-600 animate-in zoom-in-95">
      <div className="absolute top-3 right-3 z-10 bg-indigo-600/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-indigo-400/20">
        {timeLeft}m left
      </div>
      <div className="cursor-pointer overflow-hidden aspect-video bg-black flex items-center justify-center relative" onClick={onPreview}>
         {isImg && <img src={file.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
         {isVid && <video src={file.url} className="w-full h-full object-contain pointer-events-none" />}
         {isAud && <div className="text-indigo-500 scale-150"><Icons.Video /></div>}
         {!isImg && !isVid && !isAud && <div className="text-slate-700 scale-150"><Icons.File /></div>}
         <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] bg-black/60 px-4 py-2 rounded-full border border-white/10 shadow-2xl">Preview Asset</span>
         </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
           <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter">{file.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-indigo-500 uppercase">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                <span className="text-[9px] text-slate-700 font-bold">•</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase truncate">{sender}</span>
              </div>
           </div>
           <a href={file.url} download={file.name} className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-white/5 active:scale-95"><Icons.Download /></a>
        </div>
      </div>
    </div>
  );
};

const PlanCard = ({ title, price, limit, highlight, current, onSelect }: any) => (
  <div className={`p-10 rounded-2xl border-2 transition-all flex flex-col relative ${highlight ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl scale-105 z-10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}>
    {highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest italic">Best For Labs</div>}
    <h4 className="text-xl font-black text-white mb-2 italic uppercase tracking-tighter">{title}</h4>
    <div className="text-5xl font-black text-white mb-10 tracking-tighter">${price}<span className="text-sm text-slate-700 font-normal ml-1">/mo</span></div>
    <ul className="space-y-4 mb-10 flex-1 text-xs text-slate-400 font-medium">
      <li className="flex items-center gap-3"><div className="text-indigo-500"><Icons.Check /></div> {limit} Max File</li>
      <li className="flex items-center gap-3"><div className="text-indigo-500"><Icons.Check /></div> Ephemeral Storage</li>
      <li className="flex items-center gap-3"><div className="text-indigo-500"><Icons.Check /></div> Real-time Team Chat</li>
    </ul>
    <button onClick={onSelect} disabled={current} className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${current ? 'bg-indigo-600/20 text-indigo-400' : 'bg-white text-black hover:bg-slate-200'}`}>{current ? 'Active' : 'Get Started'}</button>
  </div>
);
