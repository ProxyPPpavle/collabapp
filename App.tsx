
import React, { useState, useEffect, useRef } from 'react';
import { User, Group, Message, SharedFile, FriendRequest, GroupInvite } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons } from './constants';

// Mock storage helpers
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
        username: username || email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || email}`,
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
          <p className="text-slate-500 mt-2 text-sm">Transfer. Saradnja. Privatnost.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              required
              className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder:text-slate-700"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
          <input
            type="text"
            placeholder="Email ili Username"
            required
            className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder:text-slate-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Lozinka"
            required
            className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder:text-slate-700"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
            {isLogin ? 'Prijavi se' : 'Registracija'}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-slate-500 text-sm hover:text-indigo-400 transition-colors">
          {isLogin ? "Nemaš nalog? Registruj se" : 'Imaš nalog? Prijavi se'}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'chat' | 'social'>('chat');
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [showPlans, setShowPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync with global "database"
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      // Sync friend requests
      const allRequests: FriendRequest[] = getFromStorage('cl_reqs') || [];
      setFriendRequests(allRequests.filter(r => r.toId === user.id));

      // Sync group invites
      const allInvites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
      setGroupInvites(allInvites.filter(i => i.toId === user.id));

      // Sync groups (those where user is a member)
      const allGroups: Group[] = getFromStorage('cl_groups') || [];
      setGroups(allGroups.filter(g => g.members.includes(user.id)));

      // Sync my user state (for mutual friends updates)
      const allUsers: User[] = getFromStorage('cl_users') || [];
      const updatedMe = allUsers.find(u => u.id === user.id);
      if (updatedMe && JSON.stringify(updatedMe.friends) !== JSON.stringify(user.friends)) {
        setUser(updatedMe);
      }

      // Expire messages
      const now = Date.now();
      setMessages(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(gid => {
          next[gid] = (next[gid] || []).filter(m => m.expiresAt > now);
        });
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroupId]);

  const handleSendFriendRequest = () => {
    if (!user || !searchQuery) return;
    const allUsers: User[] = getFromStorage('cl_users') || [];
    const target = allUsers.find(u => u.username === searchQuery);
    
    if (!target) { alert("Korisnik nije pronađen."); return; }
    if (target.id === user.id) { alert("Ne možeš sebi poslati zahtev."); return; }

    const reqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    if (reqs.some(r => r.fromId === user.id && r.toId === target.id)) { alert("Zahtev je već poslat."); return; }

    const newReq: FriendRequest = {
      id: Math.random().toString(36).substring(2),
      fromId: user.id,
      fromUsername: user.username,
      toId: target.id,
      timestamp: Date.now()
    };
    saveToStorage('cl_reqs', [...reqs, newReq]);
    alert(`Zahtev poslat korisniku ${target.username}`);
    setSearchQuery('');
  };

  const handleAcceptRequest = (req: FriendRequest) => {
    if (!user) return;
    const allUsers: User[] = getFromStorage('cl_users') || [];
    const meIdx = allUsers.findIndex(u => u.id === user.id);
    const himIdx = allUsers.findIndex(u => u.id === req.fromId);

    if (meIdx > -1 && himIdx > -1) {
      // Mutual friendship
      allUsers[meIdx].friends = [...new Set([...allUsers[meIdx].friends, req.fromId])];
      allUsers[himIdx].friends = [...new Set([...allUsers[himIdx].friends, user.id])];
      saveToStorage('cl_users', allUsers);
      setUser(allUsers[meIdx]); 
    }

    const allReqs: FriendRequest[] = getFromStorage('cl_reqs') || [];
    saveToStorage('cl_reqs', allReqs.filter(r => r.id !== req.id));
  };

  const handleCreateGroup = () => {
    if (!user) return;
    const name = prompt('Ime sobe:');
    if (!name) return;

    const newGroup: Group = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      ownerId: user.id,
      members: [user.id],
      createdAt: Date.now()
    };
    const allGroups = getFromStorage('cl_groups') || [];
    saveToStorage('cl_groups', [...allGroups, newGroup]);
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
  };

  const sendGroupInvite = (friendId: string) => {
    if (!activeGroupId || !user) return;
    const group = groups.find(g => g.id === activeGroupId);
    if (!group) return;

    const allInvites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
    if (allInvites.some(i => i.groupId === activeGroupId && i.toId === friendId)) {
       alert("Pozivnica već poslat.");
       return;
    }

    const newInvite: GroupInvite = {
      id: Math.random().toString(36).substring(2),
      groupId: activeGroupId,
      groupName: group.name,
      fromUsername: user.username,
      toId: friendId
    };
    saveToStorage('cl_group_invites', [...allInvites, newInvite]);
    alert("Pozivnica poslata!");
    setShowInviteMenu(false);
  };

  const handleAcceptGroupInvite = (invite: GroupInvite) => {
    if (!user) return;
    const allGroups: Group[] = getFromStorage('cl_groups') || [];
    const gIdx = allGroups.findIndex(g => g.id === invite.groupId);
    if (gIdx > -1) {
      if (!allGroups[gIdx].members.includes(user.id)) {
        allGroups[gIdx].members.push(user.id);
        saveToStorage('cl_groups', allGroups);
      }
    }
    const allInvites: GroupInvite[] = getFromStorage('cl_group_invites') || [];
    saveToStorage('cl_group_invites', allInvites.filter(i => i.id !== invite.id));
    setActiveGroupId(invite.groupId);
    setView('chat');
  };

  const handleSendMessage = async (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) {
        alert(`Fajl prevelik (Max: ${limit / 1024 / 1024}MB)`);
        return;
      }
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
    setMessages(prev => ({ ...prev, [activeGroupId]: [...(prev[activeGroupId] || []), newMessage] }));
  };

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const allUsersInSystem: User[] = getFromStorage('cl_users') || [];
  const friendsList = allUsersInSystem.filter(u => user.friends.includes(u.id));
  const activeGroupMembers = allUsersInSystem.filter(u => activeGroup?.members.includes(u.id));

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic">C</div>
            <span className="font-bold text-lg text-white tracking-tight italic">Collab Lab</span>
          </div>
          <button onClick={() => setView(view === 'chat' ? 'social' : 'chat')} className="p-2 hover:bg-white/5 rounded-lg text-indigo-400 relative">
            {view === 'chat' ? <Icons.Users /> : <Icons.Send />}
            {(friendRequests.length > 0 || groupInvites.length > 0) && view === 'chat' && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0f0f12]"></span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {view === 'chat' ? (
            <div>
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sobe</span>
                <button onClick={handleCreateGroup} className="p-1 hover:bg-white/5 rounded text-indigo-400"><Icons.Plus /></button>
              </div>
              {groups.map(g => (
                <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                  <div className={`w-2 h-2 rounded-full ${g.name === 'My Space' ? 'bg-indigo-400' : activeGroupId === g.id ? 'bg-emerald-400' : 'bg-slate-700'}`}></div>
                  <span className="font-medium text-sm truncate">{g.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3 block">Dodaj Prijatelja</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Username..." 
                    className="flex-1 bg-[#16161a] border border-white/5 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <button onClick={handleSendFriendRequest} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all"><Icons.UserPlus /></button>
                </div>
              </div>

              {(friendRequests.length > 0 || groupInvites.length > 0) && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3 block">Inbox Obaveštenja</span>
                  {/* Friend Requests */}
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl mb-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white truncate max-w-[100px]">{req.fromUsername}</span>
                        <span className="text-[9px] text-slate-500 italic">Traži prijateljstvo</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleAcceptRequest(req)} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"><Icons.Check /></button>
                        <button onClick={() => {
                           const all = getFromStorage('cl_reqs') || [];
                           saveToStorage('cl_reqs', all.filter((r:any) => r.id !== req.id));
                        }} className="p-1.5 bg-white/5 text-slate-500 rounded-lg hover:text-red-500"><Icons.X /></button>
                      </div>
                    </div>
                  ))}
                  {/* Group Invites */}
                  {groupInvites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between bg-indigo-600/10 border border-indigo-500/20 p-3 rounded-xl mb-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-indigo-400 truncate max-w-[100px]">{inv.groupName}</span>
                        <span className="text-[9px] text-slate-500 italic">Poziv od {inv.fromUsername}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleAcceptGroupInvite(inv)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"><Icons.Check /></button>
                        <button onClick={() => {
                           const all = getFromStorage('cl_group_invites') || [];
                           saveToStorage('cl_group_invites', all.filter((i:any) => i.id !== inv.id));
                        }} className="p-1.5 bg-white/5 text-slate-500 rounded-lg hover:text-red-500"><Icons.X /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3 block">Tvoji Prijatelji ({friendsList.length})</span>
                {friendsList.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 mb-1 transition-all">
                    <img src={f.avatar} className="w-8 h-8 rounded-full border border-white/5" alt="" />
                    <span className="text-xs font-medium text-slate-300 truncate">{f.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0a0a0c]">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" alt="me" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">{user.username}</p>
              <button onClick={() => setShowPlans(true)} className="text-[10px] text-indigo-500 font-bold uppercase hover:underline">{user.plan} plan</button>
            </div>
            <button onClick={() => setUser(null)} className="text-slate-600 hover:text-red-500"><Icons.LogOut /></button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {!activeGroupId || view === 'social' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-indigo-600/10 text-indigo-500 rounded-[32px] flex items-center justify-center mb-8 border border-indigo-500/10">
              {view === 'social' ? <Icons.Mail /> : <Icons.Users />}
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 italic">
              {view === 'social' ? 'Social Hub' : 'Spreman za saradnju?'}
            </h2>
            <p className="text-slate-500 max-w-sm mb-8">
              {view === 'social' 
                ? 'Ovde upravljaš prijateljima i zahtevima. Pozivi za grupe takođe stižu ovde.'
                : 'Izaberi sobu ili napravi novu. "My Space" je tvoja lična zona.'}
            </p>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <h2 className="font-bold text-lg text-white flex items-center gap-2 italic">
                    {activeGroup?.name}
                    {activeGroup?.name === 'My Space' && <span className="text-[9px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Private</span>}
                  </h2>
                </div>
                
                {/* Member List in Header */}
                <div className="flex -space-x-2">
                  {activeGroupMembers.map(m => (
                    <img key={m.id} src={m.avatar} className="w-7 h-7 rounded-full border-2 border-[#050505] bg-slate-800" title={m.username} alt="" />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {activeGroup?.ownerId === user.id && activeGroup.name !== 'My Space' && (
                  <div className="relative">
                    <button 
                      onClick={() => setShowInviteMenu(!showInviteMenu)}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-[11px] font-bold uppercase transition-all hover:bg-indigo-500 active:scale-95">
                      <Icons.Plus /> Pozovi
                    </button>
                    {showInviteMenu && (
                      <div className="absolute right-0 top-full mt-3 bg-[#0f0f12] border border-white/10 p-3 rounded-2xl w-56 shadow-2xl z-50 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3 px-1">
                           <p className="text-[10px] text-slate-500 uppercase font-black">Tvoji prijatelji</p>
                           <button onClick={() => setShowInviteMenu(false)} className="text-slate-500 hover:text-white"><Icons.X /></button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {friendsList.filter(f => !activeGroup.members.includes(f.id)).length === 0 && (
                            <p className="text-[10px] p-2 text-slate-600 italic">Nema dostupnih prijatelja.</p>
                          )}
                          {friendsList.filter(f => !activeGroup.members.includes(f.id)).map(f => (
                            <button key={f.id} onClick={() => sendGroupInvite(f.id)} className="w-full text-left p-2.5 hover:bg-white/5 rounded-xl text-xs flex items-center gap-3 group">
                               <img src={f.avatar} className="w-6 h-6 rounded-full" /> 
                               <span className="group-hover:text-indigo-400 transition-colors">{f.username}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-white/5 px-4 py-2 rounded-full flex items-center gap-2">
                  <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></div>
                  1h Life
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {(messages[activeGroupId] || []).map(msg => (
                <div key={msg.id} className={`flex gap-4 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-10 h-10 rounded-full bg-[#16161a] border border-white/5 shrink-0" alt="" />
                  <div className={`flex flex-col max-w-[75%] ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-400">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-4 rounded-[22px] ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' : 'bg-[#16161a] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                      {msg.type === 'file' ? <FileItem file={msg.file!} /> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <ChatInput onSend={handleSendMessage} plan={user.plan} />
          </>
        )}
      </div>

      {showPlans && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowPlans(false)}>
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

const FileItem = ({ file }: { file: SharedFile }) => {
  const isImg = file.type.startsWith('image/');
  const isVid = file.type.startsWith('video/');
  return (
    <div className="space-y-3 min-w-[200px]">
      {isImg && <img src={file.url} className="max-w-full rounded-xl border border-white/5 shadow-2xl" />}
      {isVid && <video src={file.url} controls className="max-w-full rounded-xl border border-white/5" />}
      <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Icons.File /></div>
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">{file.name}</p>
            <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        </div>
        <a href={file.url} download={file.name} className="p-2 hover:bg-indigo-600 hover:text-white rounded-lg text-indigo-400 transition-all"><Icons.Download /></a>
      </div>
    </div>
  );
};

const ChatInput = ({ onSend, plan }: any) => {
  const [text, setText] = useState('');
  const fr = useRef<HTMLInputElement>(null);
  const send = () => { if(text.trim()) { onSend(text); setText(''); } };
  return (
    <div className="p-6 bg-[#050505]">
      <div className="max-w-4xl mx-auto flex items-end gap-3 bg-[#0f0f12] border border-white/5 rounded-[28px] p-2 focus-within:border-indigo-500/50 transition-all shadow-2xl">
        <input type="file" className="hidden" ref={fr} onChange={e => { const f = e.target.files?.[0]; if(f) onSend('', f); if(fr.current) fr.current.value=''; }} />
        <button onClick={() => fr.current?.click()} className="p-4 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-[22px] transition-all"><Icons.Paperclip /></button>
        <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Poruka ili fajl (max ${PLAN_LIMITS[plan]/1024/1024}MB)...`} className="flex-1 bg-transparent py-4 text-sm outline-none resize-none text-white placeholder:text-slate-700" />
        <button onClick={send} className="p-4 bg-indigo-600 text-white rounded-[22px] hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"><Icons.Send /></button>
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
      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> Privatne sobe</li>
      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div> 1h Memorija</li>
    </ul>
    <button onClick={onSelect} disabled={current} className={`w-full py-4 rounded-2xl font-bold transition-all ${current ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 cursor-default' : highlight ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white text-black hover:bg-slate-200'}`}>
      {current ? 'Aktivan' : 'Odaberi'}
    </button>
  </div>
);
