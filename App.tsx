
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Group, Message, FriendRequest, Plan, SharedFile } from './types';
import { PLAN_LIMITS, EXPIRY_DURATION, Icons } from './constants';
import { getFeedbackOnMessage } from './services/gemini';

// --- MOCK DATABASE HELPER ---
const saveToStorage = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const getFromStorage = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// --- COMPONENTS ---

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
      else alert('User not found');
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        email,
        username,
        avatar: `https://picsum.photos/seed/${username}/200`,
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
            <Icons.Users />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Collab Lab</h1>
          <p className="text-gray-500 mt-2">Where teams sync effortlessly</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isLogin ? 'Email or Username' : 'Email'}</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 text-sm hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroupId]);

  // Clean up expired files/messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((gid) => {
          next[gid] = next[gid].filter((m) => m.expiresAt > now);
        });
        return next;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (text: string, file?: File) => {
    if (!user || !activeGroupId) return;

    let sharedFile: SharedFile | undefined;
    if (file) {
      const limit = PLAN_LIMITS[user.plan];
      if (file.size > limit) {
        alert(`File too large for ${user.plan} plan (Max: ${limit / 1024 / 1024}MB)`);
        return;
      }
      sharedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file)
      };
    }

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      groupId: activeGroupId,
      senderId: user.id,
      senderName: user.username,
      text: text || (file ? `Sent a file: ${file.name}` : ''),
      type: file ? 'file' : 'text',
      file: sharedFile,
      timestamp: Date.now(),
      expiresAt: Date.now() + EXPIRY_DURATION
    };

    setMessages((prev) => ({
      ...prev,
      [activeGroupId]: [...(prev[activeGroupId] || []), newMessage]
    }));

    // AI Assistant response (Gemini)
    if (text.length > 5 && !file) {
      const feedback = await getFeedbackOnMessage(text);
      if (feedback) {
        const aiMsg: Message = {
          id: 'ai-' + Date.now(),
          groupId: activeGroupId,
          senderId: 'ai-bot',
          senderName: 'Collab Assistant',
          text: feedback,
          type: 'text',
          timestamp: Date.now(),
          expiresAt: Date.now() + EXPIRY_DURATION
        };
        setTimeout(() => {
          setMessages((prev) => ({
            ...prev,
            [activeGroupId]: [...(prev[activeGroupId] || []), aiMsg]
          }));
        }, 1000);
      }
    }
  };

  const createGroup = () => {
    if (!user) return;
    const name = prompt('Group Name:');
    if (!name) return;
    const newGroup: Group = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      members: [user.id],
      createdAt: Date.now()
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
  };

  const sendFriendRequest = () => {
    const targetUsername = prompt('Enter username to add:');
    if (!targetUsername || targetUsername === user?.username) return;
    alert(`Friend request sent to ${targetUsername}! (Mocked)`);
  };

  if (!user) return <AuthPage onAuth={setUser} />;

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
            <h2 className="font-bold text-lg truncate">Collab Lab</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Workspaces</span>
              <button onClick={createGroup} className="p-1 hover:bg-slate-100 rounded text-indigo-600 transition-colors">
                <Icons.Plus />
              </button>
            </div>
            <div className="space-y-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    activeGroupId === g.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                  <span className="font-medium text-sm truncate">{g.name}</span>
                </button>
              ))}
              {groups.length === 0 && (
                <p className="text-xs text-center text-slate-400 mt-4 italic">No groups yet</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
            </div>
            <div className="space-y-1">
              <button onClick={sendFriendRequest} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm">
                <Icons.Users />
                <span>Add Friend</span>
              </button>
              <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm">
                <Icons.Sparkles />
                <span>Upgrade Plan</span>
              </button>
            </div>
          </div>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="avatar" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user.username}</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase">{user.plan} Plan</p>
            </div>
            <button onClick={() => setUser(null)} className="text-slate-400 hover:text-red-500 transition-colors">
              <Icons.LogOut />
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-inner relative">
        {!activeGroupId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 text-indigo-200">
              <Icons.Users />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Select a group to start collaborating</h3>
            <p className="text-slate-500 mt-2 max-w-sm">Share files, chat in real-time, and get AI feedback. All shared content vanishes in 1 hour.</p>
            <button onClick={createGroup} className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
              Create My First Group
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 hover:bg-slate-100 rounded-lg lg:hidden">
                  <Icons.Users />
                </button>
                <h2 className="font-bold text-lg text-slate-800">{activeGroup?.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex -space-x-2">
                  {[1,2,3].map(i => (
                    <img key={i} src={`https://picsum.photos/seed/${i}/32`} className="w-8 h-8 rounded-full border-2 border-white" alt="user" />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold">+5</div>
                </div>
                <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100">
                  Invite
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center py-8">
                <div className="inline-block px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                  ✨ Messages and files vanish after 1 hour
                </div>
              </div>
              
              {(messages[activeGroupId] || []).map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in duration-300`}>
                  {msg.senderId !== 'ai-bot' && (
                    <img src={`https://picsum.photos/seed/${msg.senderName}/100`} className="w-8 h-8 rounded-full mt-1 shrink-0 shadow-sm" alt="ava" />
                  )}
                  {msg.senderId === 'ai-bot' && (
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] shrink-0 shadow-sm">AI</div>
                  )}
                  
                  <div className={`flex flex-col max-w-[80%] ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-bold text-slate-600">{msg.senderName}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`p-3 rounded-2xl shadow-sm ${
                      msg.senderId === user.id 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : msg.senderId === 'ai-bot' 
                        ? 'bg-purple-50 text-purple-900 border border-purple-100 rounded-tl-none italic text-sm'
                        : 'bg-white border border-slate-100 rounded-tl-none'
                    }`}>
                      {msg.type === 'text' ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <FileAttachment file={msg.file!} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <ChatInput onSend={handleSendMessage} plan={user.plan} />
          </>
        )}
      </div>

      {/* Settings Modal (Plan Upgrade) */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">Upgrade Your Lab</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <PlanCard 
                  title="Free" 
                  price="0" 
                  limit="10MB" 
                  current={user.plan === 'free'}
                  onSelect={() => { setUser({...user, plan: 'free'}); setShowSettingsModal(false); }}
                />
                <PlanCard 
                  title="Pro" 
                  price="9" 
                  limit="30MB" 
                  highlight 
                  current={user.plan === 'pro'}
                  onSelect={() => { setUser({...user, plan: 'pro'}); setShowSettingsModal(false); }}
                />
                <PlanCard 
                  title="Premium" 
                  price="19" 
                  limit="100MB" 
                  current={user.plan === 'premium'}
                  onSelect={() => { setUser({...user, plan: 'premium'}); setShowSettingsModal(false); }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

const PlanCard = ({ title, price, limit, highlight, current, onSelect }: any) => (
  <div className={`p-6 rounded-2xl border-2 transition-all text-center ${highlight ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-105' : 'border-slate-100 hover:border-slate-200'}`}>
    <h4 className="font-bold text-lg mb-1">{title}</h4>
    <div className="text-3xl font-extrabold mb-4">${price}<span className="text-sm text-slate-400 font-normal">/mo</span></div>
    <ul className="text-sm text-slate-600 mb-6 space-y-2">
      <li>Files up to <strong>{limit}</strong></li>
      <li>Shared Memory</li>
      <li>Instant Feedback</li>
    </ul>
    <button 
      disabled={current}
      onClick={onSelect}
      className={`w-full py-2 rounded-xl font-bold transition-all ${current ? 'bg-slate-100 text-slate-400 cursor-default' : highlight ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' : 'bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50'}`}
    >
      {current ? 'Active' : 'Upgrade'}
    </button>
  </div>
);

const FileAttachment = ({ file }: { file: SharedFile }) => {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');

  return (
    <div className="space-y-3">
      {isImage && <img src={file.url} className="max-w-full rounded-lg shadow-sm border border-slate-200" alt="shared" />}
      {isVideo && <video src={file.url} controls className="max-w-full rounded-lg shadow-sm" />}
      {isAudio && <audio src={file.url} controls className="w-full" />}
      
      {!isImage && !isVideo && !isAudio && (
        <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Icons.File /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
            <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/50 mt-2">
        <a 
          href={file.url} 
          download={file.name}
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-200 hover:text-white transition-colors uppercase tracking-wider"
        >
          <Icons.Download /> Download
        </a>
        <span className="text-[10px] opacity-60">Expires soon</span>
      </div>
    </div>
  );
};

const ChatInput = ({ onSend, plan }: { onSend: (text: string, file?: File) => void, plan: Plan }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSend('', file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 transition-all focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
          >
            <Icons.Paperclip />
          </button>
          
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message... (Files up to ${PLAN_LIMITS[plan] / 1024 / 1024}MB)`}
            className="flex-1 bg-transparent py-3 px-2 outline-none text-sm resize-none max-h-32"
          />

          <button 
            onClick={handleSend}
            disabled={!text.trim()}
            className={`p-3 rounded-xl transition-all shadow-md ${text.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <Icons.Send />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Your files are kept in memory and will vanish after 1 hour or if you refresh.
        </p>
      </div>
    </div>
  );
};
