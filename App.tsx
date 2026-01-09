
import React, { useState, useEffect, useRef } from 'react';
import { User, Group, Message, Plan, SharedFile } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons } from './constants';
import { getFeedbackOnMessage } from './services/gemini';

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
    const users = getFromStorage('cl_users') || [];
    if (isLogin) {
      const user = users.find((u: User) => u.email === email || u.username === email);
      if (user) onAuth(user);
      else alert('Korisnik nije pronađen');
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        username: username || email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || email}`,
        plan: 'free',
        friends: [],
        friendRequests: []
      };
      users.push(newUser);
      saveToStorage('cl_users', users);
      onAuth(newUser);
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
          <p className="text-slate-500 mt-2 text-sm">Privatni transfer i saradnja.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Korisničko ime"
              required
              className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
          <input
            type="text"
            placeholder="Email ili Username"
            required
            className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Lozinka"
            required
            className="w-full bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
            {isLogin ? 'Prijavi se' : 'Napravi nalog'}
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [showPlans, setShowPlans] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroupId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(gid => {
          next[gid] = next[gid].filter(m => m.expiresAt > now);
        });
        return next;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (text: string, file?: File) => {
    if (!user || !activeGroupId) return;
    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) {
        alert(`Fajl prevelik za ${user.plan} plan (Max: ${limit / 1024 / 1024}MB)`);
        return;
      }
      sharedFile = { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) };
    }
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
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
    if (text.length > 3 && !file) {
      const feedback = await getFeedbackOnMessage(text);
      if (feedback) {
        const aiMsg: Message = {
          id: 'ai-' + Date.now(),
          groupId: activeGroupId,
          senderId: 'ai-bot',
          senderName: 'Asistent',
          text: feedback,
          type: 'text',
          timestamp: Date.now(),
          expiresAt: Date.now() + EXPIRY_DURATION
        };
        setTimeout(() => setMessages(p => ({ ...p, [activeGroupId]: [...(p[activeGroupId] || []), aiMsg] })), 600);
      }
    }
  };

  if (!user) return <AuthPage onAuth={setUser} />;
  const activeGroup = groups.find(g => g.id === activeGroupId);

  return (
    <div className="flex h-screen bg-[#050505] text-slate-300 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-[#0f0f12] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/20">C</div>
          <span className="font-bold text-xl text-white tracking-tight italic">Collab Lab</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sobe</span>
              <button onClick={() => {
                const n = prompt('Ime sobe:');
                // Fix: Corrected Math.random().toString() usage to use radix 36 and substr for valid ID generation, matching other parts of the app
                if(n) setGroups([...groups, { id: Math.random().toString(36).substr(2, 9), name: n, members:[user.id], createdAt: Date.now() }]);
              }} className="p-1 hover:bg-white/5 rounded text-indigo-400"><Icons.Plus /></button>
            </div>
            {groups.map(g => (
              <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all ${activeGroupId === g.id ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                <div className={`w-2 h-2 rounded-full ${activeGroupId === g.id ? 'bg-indigo-400' : 'bg-slate-700'}`}></div>
                <span className="font-medium text-sm truncate">{g.name}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowPlans(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-indigo-400 text-sm border border-white/5">
            <Icons.Sparkles /> <span>Vidi Planove</span>
          </button>
        </div>
        <div className="p-6 border-t border-white/5 bg-[#0a0a0c]">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border border-white/10" alt="me" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">{user.username}</p>
              <p className="text-[10px] text-indigo-500 font-bold uppercase">{user.plan} plan</p>
            </div>
            <button onClick={() => setUser(null)} className="text-slate-600 hover:text-red-500"><Icons.LogOut /></button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {!activeGroupId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-indigo-600/10 text-indigo-500 rounded-[32px] flex items-center justify-center mb-8 border border-indigo-500/10"><Icons.Users /></div>
            <h2 className="text-3xl font-bold text-white mb-4 italic">Spreman za saradnju?</h2>
            <p className="text-slate-500 max-w-sm mb-8">Izaberi sobu sa strane ili napravi novu da kreneš sa slanjem fajlova. Sve nestaje nakon 1h.</p>
          </div>
        ) : (
          <>
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-20">
              <h2 className="font-bold text-lg text-white">{activeGroup?.name}</h2>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-white/5 px-3 py-1.5 rounded-full">Automatsko čišćenje: 1h</div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {(messages[activeGroupId] || []).map(msg => (
                <div key={msg.id} className={`flex gap-4 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in duration-300`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`} className="w-10 h-10 rounded-full bg-[#16161a] border border-white/5 shrink-0" alt="ava" />
                  <div className={`flex flex-col max-w-[75%] ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-400">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`p-4 rounded-[22px] ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' : msg.senderId === 'ai-bot' ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 italic' : 'bg-[#16161a] border border-white/5 text-slate-200 rounded-tl-none'}`}>
                      {msg.type === 'file' ? <FileItem file={msg.file!} /> : <p className="text-sm leading-relaxed">{msg.text}</p>}
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowPlans(false)}>
          <div className="bg-[#0f0f12] border border-white/5 rounded-[40px] w-full max-w-4xl p-12 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-3xl font-bold text-white mb-10 text-center italic">Odaberi Plan</h3>
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
      {isImg && <img src={file.url} className="max-w-full rounded-xl border border-white/5" />}
      {isVid && <video src={file.url} controls className="max-w-full rounded-xl border border-white/5" />}
      <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Icons.File /></div>
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">{file.name}</p>
            <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        </div>
        <a href={file.url} download={file.name} className="p-2 hover:bg-white/5 rounded-lg text-indigo-400"><Icons.Download /></a>
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
        <textarea rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={`Poruka ili fajl (max ${PLAN_LIMITS[plan]/1024/1024}MB)...`} className="flex-1 bg-transparent py-4 text-sm outline-none resize-none text-white" />
        <button onClick={send} className="p-4 bg-indigo-600 text-white rounded-[22px] hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"><Icons.Send /></button>
      </div>
    </div>
  );
};

const PlanCard = ({ title, price, limit, highlight, current, onSelect }: any) => (
  <div className={`p-8 rounded-[32px] border-2 transition-all flex flex-col ${highlight ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl' : 'border-white/5 bg-white/5 hover:border-white/10'}`}>
    <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
    <div className="text-4xl font-black text-white mb-8">${price}<span className="text-sm text-slate-500 font-normal">/mo</span></div>
    <ul className="space-y-4 mb-10 flex-1 text-sm text-slate-400">
      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> Fajlovi do {limit}</li>
      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> AI Saradnik</li>
      <li className="flex items-center gap-2"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> 1h Memorija</li>
    </ul>
    <button onClick={onSelect} disabled={current} className={`w-full py-4 rounded-2xl font-bold transition-all ${current ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20' : highlight ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white text-black hover:bg-slate-200'}`}>
      {current ? 'Aktivan' : 'Odaberi'}
    </button>
  </div>
);
