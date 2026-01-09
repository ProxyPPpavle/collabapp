
import React, { useState, useEffect, useRef } from 'react';
import { User, Group, Message, SharedFile, FriendRequest, GroupInvite } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons } from './constants';

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
      } else {
        alert('Korisnik nije pronađen'); // Ostavljamo ovaj alert privremeno jer nemamo globalni toast ovde, ali unutar app menjamo sve
      }
    } else {
      if (users.some(u => u.username === username)) {
        alert("Korisničko ime već postoji!");
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
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      <div className="bg-[#0f0f12] border border-white/5 p-10 rounded-[32px] w-full max-w-md shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
            <Icons.Video />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight italic">Collab Lab</h1>
          <p className="text-slate-500 mt-2 text-sm">Workspace & File Transfer</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input type="text" placeholder="Username" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          <input type="text" placeholder="Email ili Username" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Lozinka" required className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-500 transition-all">{isLogin ? 'Prijavi se' : 'Registracija'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-slate-500 text-sm">{isLogin ? "Nemaš nalog? Registruj se" : 'Imaš nalog? Prijavi se'}</button>
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const users: User[] = getFromStorage('cl_users') || [];
      const meIdx = users.findIndex(u => u.id === user.id);
      if (meIdx > -1) {
        users[meIdx].lastSeen = Date.now();
        saveToStorage('cl_users', users);
        setAllUsers(users);
      }

      const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
      const myReqs = reqs.filter(r => r.toId === user.id);
      if (JSON.stringify(myReqs) !== JSON.stringify(friendRequests)) {
        setFriendRequests(myReqs);
      }
      
      const invites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
      const myInvites = invites.filter(i => i.toId === user.id);
      if (JSON.stringify(myInvites) !== JSON.stringify(groupInvites)) {
        setGroupInvites(myInvites);
      }

      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      setGroups(allGroups.filter(g => g.members.includes(user.id)));

      if (activeGroupId) {
        const msgKey = `cl_msgs_${activeGroupId}`;
        const groupMsgs: Message[] = getFromStorage(msgKey) || [];
        const now = Date.now();
        const validMsgs = groupMsgs.filter(m => m.expiresAt > now);
        if (JSON.stringify(validMsgs) !== JSON.stringify(messages)) {
          setMessages(validMsgs);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [user, activeGroupId, messages, friendRequests, groupInvites]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendFriendRequest = () => {
    if (!user || !searchQuery) return;
    const target = allUsers.find(u => u.username === searchQuery);
    if (!target) { showToast("Korisnik nije pronađen.", 'error'); return; }
    if (target.id === user.id) return;
    const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    if (reqs.some(r => r.fromId === user.id && r.toId === target.id)) {
      showToast("Zahtev je već poslat.", 'error');
      return;
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
    showToast("Ušao si u grupu!");
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newG = { id: Math.random().toString(36).substring(2,9), name: newGroupName, ownerId: user!.id, members: [user!.id], createdAt: Date.now() };
    const all = getFromStorage('cl_groups') || [];
    saveToStorage('cl_groups', [...all, newG]);
    setShowCreateGroup(false);
    setNewGroupName('');
    setActiveGroupId(newG.id);
    showToast("Grupa kreirana!");
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) { showToast("Fajl prevelik za tvoj plan!", 'error'); return; }
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
    if (file) showToast("Fajl je poslat!");
  };

  const isOnline = (u: User) => u.lastSeen && (Date.now() - u.lastSeen < 10000);

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const friendsList = allUsers.filter(u => user.friends.includes(u.id));
  const activeMembers = allUsers.filter(u => activeGroup?.members?.includes(u.id) ?? false);

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden relative">
      
      {/* GLOBAL TOAST */}
      {toast && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[500] px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-2xl animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* SIDEBAR - DUAL COLUMN (FRIENDS | GROUPS) */}
      <div className="w-[480px] bg-[#0f0f12] border-r border-white/5 flex shrink-0 shadow-2xl z-30">
        
        {/* Left Column: Friends */}
        <div className="w-1/2 border-r border-white/5 flex flex-col h-full">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-indigo-500"><Icons.Users /></div>
              <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-indigo-400">Prijatelji</span>
            </div>
            {/* Inbox Button uvek vidljiv ovde */}
            <button onClick={() => setShowInbox(!showInbox)} className={`relative p-2 rounded-xl transition-all ${showInbox ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-500'}`}>
              <Icons.Mail />
              {(friendRequests.length > 0 || groupInvites.length > 0) && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0f0f12] animate-pulse"></div>
              )}
            </button>
          </div>
          <div className="p-4 border-b border-white/5 shrink-0">
            <div className="flex gap-2">
              <input type="text" placeholder="Traži..." className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-indigo-500 transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button onClick={handleSendFriendRequest} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all active:scale-95"><Icons.UserPlus /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {friendsList.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group cursor-pointer border border-transparent hover:border-white/5">
                <div className="relative">
                  <img src={f.avatar} className="w-9 h-9 rounded-2xl border border-white/10 bg-slate-900 object-cover" />
                  {isOnline(f) && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f0f12] shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-bold text-slate-200 truncate">{f.username}</span>
                  <span className="text-[9px] text-slate-500 font-medium tracking-wide uppercase">{isOnline(f) ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Groups */}
        <div className="w-1/2 flex flex-col h-full bg-[#0a0a0c]">
          <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-emerald-500"><Icons.Video /></div>
              <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-emerald-400">Lab Sobe</span>
            </div>
            <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"><Icons.Plus /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {groups.sort((a,b) => a.name === 'My Space' ? -1 : 1).map(g => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all border ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-xl' : 'hover:bg-white/5 border-transparent'}`}>
                <div className={`w-2 h-2 rounded-full ${g.name === 'My Space' ? 'bg-indigo-400' : 'bg-slate-700'}`}></div>
                <span className="text-xs font-bold truncate uppercase tracking-widest">{g.name}</span>
              </button>
            ))}
          </div>
          
          <div className="p-5 border-t border-white/5 bg-black/40 shrink-0">
             <div className="flex items-center gap-3">
               <img src={user.avatar} className="w-10 h-10 rounded-2xl border border-white/5" />
               <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white truncate italic uppercase tracking-tighter">{user.username}</p>
                  <button onClick={() => setShowPlans(true)} className="text-[9px] uppercase font-black text-indigo-500 hover:text-indigo-400 flex items-center gap-1 transition-colors">
                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div>
                    {user.plan} LAB PLAN
                  </button>
               </div>
               <button onClick={() => setUser(null)} className="text-slate-600 hover:text-red-500 p-2 transition-colors"><Icons.LogOut /></button>
             </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-30 select-none">
             <div className="w-24 h-24 bg-indigo-600/10 text-indigo-500 rounded-[40px] flex items-center justify-center mb-8 border border-indigo-500/10 animate-pulse">
               <Icons.Sparkles />
             </div>
             <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Workspace Inaktivni</h2>
             <p className="text-xs max-w-xs text-slate-500 leading-relaxed font-medium uppercase tracking-widest">Odaberi ili napravi lab sobu da započneš transfer fajlova i komunikaciju u realnom vremenu.</p>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505] z-20 shrink-0">
               <div className="flex items-center gap-6 min-w-0">
                  <div className="flex flex-col">
                    <h2 className="font-black text-lg text-white italic truncate uppercase tracking-tighter">{activeGroup.name}</h2>
                    <span className="text-[8px] font-bold text-indigo-500 tracking-[0.3em] uppercase">Active Session</span>
                  </div>
                  <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {activeMembers.slice(0, 4).map(m => (
                      <img key={m.id} src={m.avatar} className="w-7 h-7 rounded-xl border-2 border-[#050505] bg-slate-900" title={m.username} />
                    ))}
                    {activeMembers.length > 4 && <div className="w-7 h-7 rounded-xl bg-indigo-900 flex items-center justify-center text-[9px] font-black border-2 border-[#050505] text-white">+{activeMembers.length-4}</div>}
                  </div>
                  <button onClick={() => setShowAbout(true)} className="text-[9px] bg-white/5 px-3 py-1.5 rounded-xl uppercase font-black tracking-widest hover:bg-white/10 border border-white/5 transition-all active:scale-95">About</button>
               </div>
               
               <div className="flex items-center gap-4">
                  {activeGroup.ownerId === user.id && activeGroup.name !== 'My Space' && (
                    <button onClick={() => setShowInviteMenu(!showInviteMenu)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20">Pozovi Tim</button>
                  )}
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* CHAT PANEL */}
              <div className="flex-1 flex flex-col border-r border-white/5 bg-[#050505]">
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {messages.filter(m => m.type === 'text').map(msg => (
                    <div key={msg.id} className={`flex gap-4 ${msg.senderId === user.id ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-8 h-8 rounded-xl bg-slate-900 shrink-0 border border-white/10" alt="" />
                      <div className={`flex flex-col max-w-[75%] ${msg.senderId === user.id ? 'items-end' : ''}`}>
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{msg.senderName}</span>
                          <span className="text-[8px] text-slate-700 font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className={`p-4 rounded-[24px] text-xs leading-relaxed shadow-sm ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#121216] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-6 border-t border-white/5 bg-[#050505]">
                  <ChatInput onSend={handleSendMessage} />
                </div>
              </div>

              {/* FILE GALLERY */}
              <div className="w-[340px] bg-[#0a0a0c] flex flex-col shrink-0">
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0a0a0c]/80 backdrop-blur-md">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Asset Lab</span>
                    <span className="text-[8px] font-bold text-slate-700">1H EPHEMERAL STORAGE</span>
                  </div>
                  <input type="file" id="file-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value=''; }} />
                  <label htmlFor="file-up" className="p-3 bg-indigo-600 text-white rounded-2xl cursor-pointer hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/10 active:scale-95"><Icons.Paperclip /></label>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.filter(m => m.type === 'file').map(msg => (
                    <FileItem key={msg.id} file={msg.file!} sender={msg.senderName} time={msg.timestamp} expiresAt={msg.expiresAt} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT INBOX DRAWER */}
      {showInbox && (
        <div className="w-96 bg-[#0f0f12] border-l border-white/10 flex flex-col shrink-0 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[100] animate-in slide-in-from-right duration-400">
           <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex flex-col">
                <span className="font-black text-sm uppercase text-white italic tracking-tighter">Inboks Obaveštenja</span>
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Timski Zahtevi</span>
              </div>
              <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><Icons.X /></button>
           </div>
           <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {friendRequests.length === 0 && groupInvites.length === 0 && (
                <div className="text-center py-32 opacity-20 flex flex-col items-center italic text-[10px] uppercase tracking-widest select-none font-bold">
                  <div className="mb-4"><Icons.Mail /></div>
                  Mirno je ovde...
                </div>
              )}
              {friendRequests.map(req => (
                <div key={req.id} className="bg-indigo-600/5 border border-indigo-500/10 p-5 rounded-3xl space-y-4 group transition-all hover:border-indigo-500/30">
                  <div className="flex items-center gap-3">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.fromUsername}`} className="w-8 h-8 rounded-xl bg-slate-900" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-white">{req.fromUsername}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Želi da se poveže</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptRequest(req)} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/10">Prihvati</button>
                    <button onClick={() => {
                       const all = getFromStorage('cl_reqs') || [];
                       saveToStorage('cl_reqs', all.filter((r:any) => r.id !== req.id));
                    }} className="px-4 py-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-red-500 transition-all"><Icons.X /></button>
                  </div>
                </div>
              ))}
              {groupInvites.map(inv => (
                <div key={inv.id} className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl space-y-4 group transition-all hover:border-emerald-500/30">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Poziv Za Lab</span>
                    <span className="text-sm font-black text-white italic truncate">{inv.groupName}</span>
                    <span className="text-[10px] font-medium text-emerald-400 mt-1">od {inv.fromUsername}</span>
                  </div>
                  <button onClick={() => handleAcceptInvite(inv)} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/10 italic">Uđi u Workspace</button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-[#0f0f12] border border-white/10 rounded-[40px] w-full max-w-sm p-10 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col">
                <h3 className="font-black italic text-2xl uppercase tracking-tighter text-white">Nova Lab Soba</h3>
                <span className="text-[9px] font-black text-emerald-500 tracking-[0.3em] uppercase">Kreiraj Workspace</span>
              </div>
              <button onClick={() => setShowCreateGroup(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Icons.X /></button>
            </div>
            <div className="space-y-6">
              <input 
                type="text" 
                placeholder="Ime Grupe..." 
                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-sm outline-none focus:border-emerald-500 transition-all text-white font-bold"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
              />
              <button 
                onClick={handleCreateGroup}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
              >
                Kreiraj Sobu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[48px] w-full max-sm p-10 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-8 relative z-10">
                 <h3 className="font-black italic text-2xl uppercase tracking-tighter text-white">Lab Info</h3>
                 <button onClick={() => setShowAbout(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Icons.X /></button>
              </div>
              <div className="space-y-8 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Timski Članovi</p>
                  <div className="space-y-3">
                    {activeMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-2xl">
                         <div className="flex items-center gap-4">
                           <img src={m.avatar} className="w-8 h-8 rounded-xl bg-slate-900 border border-white/5" />
                           <span className="text-[11px] font-black text-slate-200">{m.username}</span>
                         </div>
                         <div className={`w-2 h-2 rounded-full ${isOnline(m) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {showPlans && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6" onClick={() => setShowPlans(false)}>
          <div className="bg-[#0f0f12] border border-white/5 rounded-[56px] w-full max-w-4xl p-16 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="grid md:grid-cols-3 gap-10">
              <PlanCard title="Free" price="0" limit="10MB" current={user.plan === 'free'} onSelect={() => setUser({...user, plan: 'free'})} />
              <PlanCard title="Pro" price="9" limit="30MB" highlight current={user.plan === 'pro'} onSelect={() => setUser({...user, plan: 'pro'})} />
              <PlanCard title="Premium" price="19" limit="100MB" current={user.plan === 'premium'} onSelect={() => setUser({...user, plan: 'premium'})} />
            </div>
          </div>
        </div>
      )}

      {showInviteMenu && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-6" onClick={() => setShowInviteMenu(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[40px] w-full max-w-xs p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h4 className="text-[12px] font-black uppercase text-white tracking-widest italic">Invite Friends</h4>
                 <button onClick={() => setShowInviteMenu(false)} className="text-slate-500"><Icons.X /></button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {friendsList.filter(f => !activeGroup?.members?.includes(f.id)).map(f => (
                  <button key={f.id} onClick={() => {
                    const all = getFromStorage('cl_group_invites') || [];
                    saveToStorage('cl_group_invites', [...all, { id: Math.random().toString(36).substring(2), groupId: activeGroup!.id, groupName: activeGroup!.name, fromUsername: user.username, toId: f.id }]);
                    setShowInviteMenu(false); showToast("Poziv poslat!");
                  }} className="w-full flex items-center gap-3 p-3 hover:bg-indigo-600/10 border border-transparent hover:border-indigo-500/20 rounded-2xl text-[12px] font-bold group transition-all">
                    <img src={f.avatar} className="w-8 h-8 rounded-xl border border-white/10 group-hover:scale-105 transition-transform" /> 
                    <span className="truncate">{f.username}</span>
                  </button>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const ChatInput: React.FC<{ onSend: (t: string) => void }> = ({ onSend }) => {
  const [text, setText] = useState('');
  const handleSend = () => { if(text.trim()) { onSend(text); setText(''); } };
  return (
    <div className="flex items-end gap-3 bg-[#0f0f12] border border-white/5 rounded-[28px] p-3 focus-within:border-indigo-500/40 transition-all shadow-inner">
      <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Piši ovde..." className="flex-1 bg-transparent py-3 px-5 text-sm outline-none resize-none text-white placeholder:text-slate-700 font-medium" />
      <button onClick={handleSend} className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${text.trim() ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white/5 text-slate-700 cursor-not-allowed'}`}><Icons.Send /></button>
    </div>
  );
};

const FileItem: React.FC<{ file: SharedFile, sender: string, time: number, expiresAt: number }> = ({ file, sender, time, expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState(Math.round((expiresAt - Date.now()) / 1000 / 60));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000 / 60))), 30000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');

  return (
    <div className="bg-[#121216] border border-white/5 rounded-3xl overflow-hidden shadow-2xl group relative animate-in zoom-in-95 duration-300">
      <div className="absolute top-3 left-3 z-10 bg-indigo-600 px-3 py-1.5 rounded-xl text-[9px] font-black text-white border border-indigo-400/30 shadow-xl uppercase tracking-tighter">
        {timeLeft}m left
      </div>
      {isImg && <div className="aspect-video bg-black"><img src={file.url} className="w-full h-full object-cover" /></div>}
      {isVid && <div className="aspect-video bg-black flex items-center justify-center"><video src={file.url} className="w-full h-full object-contain" controls /></div>}
      {!isImg && !isVid && <div className="h-32 bg-indigo-900/10 flex items-center justify-center text-indigo-500 border-b border-white/5"><Icons.File /></div>}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
           <div className="min-w-0">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{file.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase truncate">• {sender}</span>
              </div>
           </div>
           <a href={file.url} download={file.name} className="p-3 bg-white/5 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all border border-white/5 active:scale-95"><Icons.Download /></a>
        </div>
      </div>
    </div>
  );
};

const PlanCard = ({ title, price, limit, highlight, current, onSelect }: any) => (
  <div className={`p-10 rounded-[56px] border-2 transition-all flex flex-col relative group ${highlight ? 'border-indigo-600 bg-indigo-600/5 shadow-[0_0_80px_rgba(99,102,241,0.15)] scale-105 z-10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}>
    {highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest italic shadow-xl">Preporučeno</div>}
    <h4 className="text-xl font-black text-white mb-2 italic uppercase tracking-tighter">{title}</h4>
    <div className="text-5xl font-black text-white mb-10 tracking-tighter">${price}<span className="text-sm text-slate-700 font-normal ml-1 italic">/mo</span></div>
    <ul className="space-y-5 mb-12 flex-1 text-xs text-slate-400 font-medium">
      <li className="flex items-center gap-3"><div className="text-indigo-500 shrink-0"><Icons.Check /></div> {limit} Max File Size</li>
      <li className="flex items-center gap-3"><div className="text-indigo-500 shrink-0"><Icons.Check /></div> Real-time Timski Lab</li>
      <li className="flex items-center gap-3"><div className="text-indigo-500 shrink-0"><Icons.Check /></div> Ephemeral 1H Storage</li>
    </ul>
    <button onClick={onSelect} disabled={current} className={`w-full py-5 rounded-[28px] font-black uppercase tracking-widest transition-all ${current ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-inner' : highlight ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/30' : 'bg-white text-black hover:bg-slate-200'}`}>{current ? 'Aktivan Plan' : 'Aktiviraj'}</button>
  </div>
);
