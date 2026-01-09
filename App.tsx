
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
      } else alert('Korisnik nije pronađen');
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync Interval
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      // 1. Update my lastSeen
      const users: User[] = getFromStorage('cl_users') || [];
      const meIdx = users.findIndex(u => u.id === user.id);
      if (meIdx > -1) {
        users[meIdx].lastSeen = Date.now();
        saveToStorage('cl_users', users);
        setAllUsers(users);
      }

      // 2. Sync Requests & Invites
      const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
      setFriendRequests(reqs.filter(r => r.toId === user.id));
      const invites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
      setGroupInvites(invites.filter(i => i.toId === user.id));

      // 3. Sync Groups
      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      setGroups(allGroups.filter(g => g.members.includes(user.id)));

      // 4. Sync Messages for active group
      if (activeGroupId) {
        const msgKey = `cl_msgs_${activeGroupId}`;
        const groupMsgs: Message[] = getFromStorage(msgKey) || [];
        const now = Date.now();
        const validMsgs = groupMsgs.filter(m => m.expiresAt > now);
        if (JSON.stringify(validMsgs) !== JSON.stringify(messages)) {
          setMessages(validMsgs);
          if (groupMsgs.length !== validMsgs.length) saveToStorage(msgKey, validMsgs);
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [user, activeGroupId, messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendFriendRequest = () => {
    if (!user || !searchQuery) return;
    const target = allUsers.find(u => u.username === searchQuery);
    if (!target) { alert("Korisnik nije pronađen."); return; }
    if (target.id === user.id) return;
    const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    if (reqs.some(r => r.fromId === user.id && r.toId === target.id)) return;
    const newReq = { id: Math.random().toString(36).substring(2), fromId: user.id, fromUsername: user.username, toId: target.id, timestamp: Date.now() };
    saveToStorage('cl_reqs', [...reqs, newReq]);
    alert("Zahtev poslat!");
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
  };

  const handleSendMessage = (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) { alert("Fajl prevelik!"); return; }
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
  };

  const isOnline = (u: User) => u.lastSeen && (Date.now() - u.lastSeen < 10000);

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const friendsList = allUsers.filter(u => user.friends.includes(u.id));
  const activeMembers = allUsers.filter(u => activeGroup?.members.includes(u.id));

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300">
      {/* SIDEBAR */}
      <div className="w-80 bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic">C</div>
          <span className="font-bold text-lg text-white italic">Collab Lab</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          {/* Inbox Section */}
          {(friendRequests.length > 0 || groupInvites.length > 0) && (
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-3 block">Inbox Obaveštenja</span>
              {friendRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl mb-2 border border-indigo-500/20">
                   <div className="flex flex-col text-xs">
                     <span className="font-bold text-white">{req.fromUsername}</span>
                     <span className="text-slate-500 text-[10px]">Friend request</span>
                   </div>
                   <div className="flex gap-1">
                     <button onClick={() => handleAcceptRequest(req)} className="p-1.5 bg-indigo-600 rounded-lg"><Icons.Check /></button>
                     <button onClick={() => {
                        const all = getFromStorage('cl_reqs') || [];
                        saveToStorage('cl_reqs', all.filter((r:any) => r.id !== req.id));
                     }} className="p-1.5 bg-white/5 rounded-lg text-slate-500"><Icons.X /></button>
                   </div>
                </div>
              ))}
              {groupInvites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between bg-emerald-500/5 p-3 rounded-xl mb-2 border border-emerald-500/20">
                   <div className="flex flex-col text-xs">
                     <span className="font-bold text-emerald-400">{inv.groupName}</span>
                     <span className="text-slate-500 text-[10px]">Invited by {inv.fromUsername}</span>
                   </div>
                   <div className="flex gap-1">
                     <button onClick={() => handleAcceptInvite(inv)} className="p-1.5 bg-emerald-600 rounded-lg text-white"><Icons.Check /></button>
                   </div>
                </div>
              ))}
            </div>
          )}

          {/* Sobe Section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moje Sobe</span>
              <button onClick={() => {
                 const name = prompt("Ime grupe:");
                 if(name) {
                    const newG = { id: Math.random().toString(36).substring(2,9), name, ownerId: user.id, members: [user.id], createdAt: Date.now() };
                    const all = getFromStorage('cl_groups') || [];
                    saveToStorage('cl_groups', [...all, newG]);
                 }
              }} className="p-1 text-indigo-400"><Icons.Plus /></button>
            </div>
            {groups.map(g => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-xl' : 'hover:bg-white/5 border border-transparent'}`}>
                <div className={`w-2 h-2 rounded-full ${g.name === 'My Space' ? 'bg-indigo-400' : 'bg-slate-700'}`}></div>
                <span className="text-sm font-medium truncate">{g.name}</span>
              </button>
            ))}
          </div>

          {/* Prijatelji Section */}
          <div>
            <div className="px-2 mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Prijatelji</span>
              <div className="flex gap-2">
                <input type="text" placeholder="Dodaj po username..." className="flex-1 bg-[#16161a] border border-white/5 rounded-xl px-3 py-2 text-[11px] outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <button onClick={handleSendFriendRequest} className="p-2 bg-indigo-600 text-white rounded-xl"><Icons.UserPlus /></button>
              </div>
            </div>
            {friendsList.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl">
                <div className="relative">
                  <img src={f.avatar} className="w-8 h-8 rounded-full border border-white/5" alt="" />
                  {isOnline(f) && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0f0f12]"></div>}
                </div>
                <span className="text-xs font-medium text-slate-300">{f.username}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0a0a0c]">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full" alt="" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">{user.username}</p>
              <button onClick={() => setShowPlans(true)} className="text-[10px] text-indigo-500 font-bold uppercase">{user.plan} plan</button>
            </div>
            <button onClick={() => setUser(null)} className="text-slate-600 hover:text-red-500"><Icons.LogOut /></button>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col">
        {!activeGroup ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-50">
             <div className="w-20 h-20 bg-indigo-600/10 text-indigo-500 rounded-[32px] flex items-center justify-center mb-6 border border-indigo-500/10"><Icons.Users /></div>
             <h2 className="text-2xl font-bold text-white mb-2 italic">Dobrodošao u Collab Lab</h2>
             <p className="text-sm max-w-xs text-slate-500">Izaberi sobu iz sidebara da započneš transfer i dopisivanje.</p>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-xl z-20 shrink-0">
               <div className="flex items-center gap-4">
                  <h2 className="font-bold text-lg text-white italic">{activeGroup.name}</h2>
                  <div className="h-4 w-[1px] bg-white/10"></div>
                  <button onClick={() => setShowAbout(true)} className="text-[10px] text-slate-500 font-bold uppercase hover:text-indigo-400 transition-colors">O grupi</button>
               </div>
               
               <div className="flex items-center gap-4">
                  {activeGroup.ownerId === user.id && activeGroup.name !== 'My Space' && (
                    <div className="relative">
                      <button onClick={() => setShowInviteMenu(!showInviteMenu)} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-[11px] font-bold uppercase hover:bg-indigo-500">Pozovi</button>
                      {showInviteMenu && (
                        <div className="absolute right-0 top-full mt-3 bg-[#16161a] border border-white/10 p-2 rounded-2xl w-56 shadow-2xl z-50">
                          <p className="text-[9px] text-slate-500 uppercase font-black px-2 py-1">Tvoji Prijatelji</p>
                          {friendsList.filter(f => !activeGroup.members.includes(f.id)).map(f => (
                            <button key={f.id} onClick={() => {
                               const all = getFromStorage('cl_group_invites') || [];
                               saveToStorage('cl_group_invites', [...all, { id: Math.random().toString(36).substring(2), groupId: activeGroup.id, groupName: activeGroup.name, fromUsername: user.username, toId: f.id }]);
                               setShowInviteMenu(false); alert("Poziv poslat!");
                            }} className="w-full text-left p-2.5 hover:bg-white/5 rounded-xl text-xs flex items-center gap-3">
                               <img src={f.avatar} className="w-6 h-6 rounded-full" /> {f.username}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-white/5 px-4 py-2 rounded-full flex items-center gap-2">
                    <div className="w-1 h-1 bg-amber-500 rounded-full"></div> 1h Life
                  </div>
               </div>
            </div>

            {/* SPLIT VIEW */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Messages (Chat) */}
              <div className="flex-[0.65] border-r border-white/5 flex flex-col bg-[#050505]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.filter(m => m.type === 'text').map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-8 h-8 rounded-full border border-white/5 bg-slate-900 shrink-0" alt="" />
                      <div className={`flex flex-col max-w-[80%] ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-500 mb-1 px-1 font-bold">{msg.senderName}</span>
                        <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#16161a] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-6 bg-[#050505]">
                   <div className="flex items-end gap-3 bg-[#0f0f12] border border-white/5 rounded-3xl p-2 focus-within:border-indigo-500/50">
                      <textarea rows={1} placeholder="Tekstualna poruka..." className="flex-1 bg-transparent py-4 px-4 text-sm outline-none resize-none text-white" 
                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage((e.target as any).value); (e.target as any).value = ''; } }} />
                   </div>
                </div>
              </div>

              {/* Right: Files (Gallery) */}
              <div className="flex-[0.35] bg-[#0a0a0c] flex flex-col">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared Files</span>
                  <input type="file" id="file-up" className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage('', e.target.files[0]); e.target.value = ''; }} />
                  <label htmlFor="file-up" className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"><Icons.Paperclip /></label>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.filter(m => m.type === 'file').map(msg => (
                    <div key={msg.id} className="animate-in fade-in slide-in-from-right-2">
                       <FileItem file={msg.file!} sender={msg.senderName} time={msg.timestamp} />
                    </div>
                  ))}
                  {messages.filter(m => m.type === 'file').length === 0 && (
                    <div className="text-center py-20 opacity-20">
                      <Icons.File />
                      <p className="text-[10px] mt-2 font-bold uppercase tracking-widest">Nema fajlova</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setShowAbout(false)}>
           <div className="bg-[#0f0f12] border border-white/10 rounded-[32px] w-full max-w-md p-8 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white italic">O Grupi</h3>
                <button onClick={() => setShowAbout(false)} className="p-2 hover:bg-white/5 rounded-full"><Icons.X /></button>
              </div>
              <div className="space-y-6">
                 <div>
                   <p className="text-[10px] text-slate-500 uppercase font-black mb-3">Naziv</p>
                   <p className="text-white font-bold text-lg">{activeGroup?.name}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-slate-500 uppercase font-black mb-3">Članovi ({activeMembers.length})</p>
                   <div className="space-y-3">
                     {activeMembers.map(m => (
                       <div key={m.id} className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <img src={m.avatar} className="w-8 h-8 rounded-full border border-white/5" />
                           <span className="text-sm font-medium">{m.username} {m.id === activeGroup?.ownerId && <span className="text-[9px] text-indigo-500 font-bold ml-1">(Owner)</span>}</span>
                         </div>
                         <div className={`w-2 h-2 rounded-full ${isOnline(m) ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showPlans && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setShowPlans(false)}>
          <div className="bg-[#0f0f12] border border-white/5 rounded-[40px] w-full max-w-4xl p-12 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-bold text-white italic">Upgrade Lab</h3>
              <button onClick={() => setShowPlans(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><Icons.X /></button>
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

const FileItem = ({ file, sender, time }: { file: SharedFile, sender: string, time: number }) => {
  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');
  return (
    <div className="bg-[#16161a] border border-white/5 rounded-2xl overflow-hidden shadow-lg group">
      {isImg && <img src={file.url} className="w-full h-auto max-h-48 object-cover border-b border-white/5" />}
      {isVid && <video src={file.url} controls className="w-full h-auto max-h-48 border-b border-white/5" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
           <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate mb-1">{file.name}</p>
              <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB • {sender}</p>
           </div>
           <a href={file.url} download={file.name} className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Icons.Download /></a>
        </div>
      </div>
    </div>
  );
};

const PlanCard = ({ title, price, limit, highlight, current, onSelect }: any) => (
  <div className={`p-8 rounded-[32px] border-2 transition-all flex flex-col ${highlight ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl scale-105 z-10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}>
    <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
    <div className="text-4xl font-black text-white mb-8">${price}<span className="text-sm text-slate-500 font-normal">/mo</span></div>
    <ul className="space-y-4 mb-10 flex-1 text-sm text-slate-400">
      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> Fajlovi do {limit}</li>
      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> Split View Dashboard</li>
      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> 1h Memorija</li>
    </ul>
    <button onClick={onSelect} disabled={current} className={`w-full py-4 rounded-2xl font-bold transition-all ${current ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : highlight ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white text-black hover:bg-slate-200'}`}>
      {current ? 'Aktivan' : 'Odaberi'}
    </button>
  </div>
);
