import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Users, 
  User, 
  Plus, 
  Search, 
  Heart, 
  MessageCircle, 
  Repeat, 
  MoreHorizontal, 
  Send, 
  Image as ImageIcon, 
  Camera, 
  Shield, 
  Flag, 
  Slash,
  ChevronLeft,
  Sparkles,
  Trash2,
  ArrowLeft,
  Settings,
  ArrowRight
} from 'lucide-react';
import { UserProfile, Post, Chat, Message, OperationType } from '../types';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  arrayUnion, 
  arrayRemove,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { handleFirestoreError, cleanObject } from '../lib/firestore';
import { format, formatDistanceToNow } from 'date-fns';

import { getSmartGroupSuggestions } from '../services/communityService';
import { unlockAchievement } from '../services/achievementService';

interface CommunityProps {
  profile: UserProfile;
}

type CommunityView = 'feed' | 'messages' | 'groups' | 'profile';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
];

export default function Community({ profile }: CommunityProps) {
  const [view, setView] = useState<CommunityView>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [showReportModal, setShowReportModal] = useState<{ id: string, type: 'post' | 'comment' | 'user' } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Render even if Firestore never replies.
    const fallback = setTimeout(() => setLoading(false), 4000);

    // Listen to posts
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      const newPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(newPosts);
      setLoading(false);
    }, (error) => { handleFirestoreError(error, OperationType.LIST, 'posts'); setLoading(false); });

    // Listen to chats
    const qChats = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubChats = onSnapshot(qChats, (snapshot) => {
      const newChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(newChats);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    return () => {
      clearTimeout(fallback);
      unsubPosts();
      unsubChats();
    };
  }, []);

  const renderView = () => {
    switch (view) {
      case 'feed':
        return <Feed profile={profile} posts={posts} onReport={(id, type) => setShowReportModal({ id, type })} />;
      case 'messages':
        return activeChat ? (
          <ChatView chat={activeChat} profile={profile} onBack={() => setActiveChat(null)} />
        ) : (
          <MessagesList chats={chats} profile={profile} onSelectChat={setActiveChat} />
        );
      case 'groups':
        return <Groups profile={profile} />;
      case 'profile':
        return <UserProfileView profile={profile} />;
      default:
        return <Feed profile={profile} posts={posts} onReport={(id, type) => setShowReportModal({ id, type })} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fdfdfd]">
      {/* Header with Sub-Navigation */}
      <header className="px-6 pt-10 pb-4 flex flex-col gap-6 sticky top-0 z-30 bg-[#fdfdfd]/95 backdrop-blur-xl border-b border-gray-50">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-charcoal tracking-tight uppercase leading-none">Community</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1.5">Network Protocol Active</p>
          </div>
          <button 
            onClick={() => setView('profile')} 
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${view === 'profile' ? 'bg-charcoal text-white shadow-xl' : 'bg-white border border-gray-100 text-gray-400 hover:text-charcoal shadow-sm'}`}
          >
            <User size={22} />
          </button>
        </div>

        <div className="flex bg-gray-50 p-1 rounded-[24px] border border-gray-100 shadow-inner">
          {[
            { id: 'feed', label: 'Feed', icon: MessageSquare },
            { id: 'messages', label: 'Inbox', icon: Send },
            { id: 'groups', label: 'Clans', icon: Users },
          ].map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive ? 'bg-white text-charcoal shadow-md scale-[1.02]' : 'text-gray-300 hover:text-gray-400'
                }`}
              >
                <item.icon size={14} strokeWidth={isActive ? 3 : 2} className={isActive ? 'text-sage' : ''} />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {renderView()}
      </main>

      <AnimatePresence>
        {showReportModal && (
          <ReportModal 
            targetId={showReportModal.id} 
            targetType={showReportModal.type} 
            onClose={() => setShowReportModal(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RailNavButton({ active, icon: Icon, onClick }: { active: boolean, icon: any, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ${active ? 'bg-white text-charcoal' : 'text-white/40 hover:text-white'}`}
    >
      <Icon size={20} />
      {active && (
        <motion.div 
          layoutId="rail-nav-active"
          className="absolute inset-0 bg-white rounded-full -z-10"
          transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
        />
      )}
    </button>
  );
}

function Feed({ profile, posts, onReport }: { profile: UserProfile, posts: Post[], onReport: (id: string, type: 'post' | 'comment' | 'user') => void }) {
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!newPost.trim() || !auth.currentUser) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'posts'), cleanObject({
        userId: auth.currentUser.uid,
        authorName: profile.displayName || auth.currentUser.displayName || 'Anonymous',
        authorPhoto: profile.photoURL || auth.currentUser.photoURL,
        content: newPost,
        createdAt: new Date().toISOString(),
        likes: [],
        commentCount: 0,
        repostCount: 0
      }));
      await unlockAchievement('social_post');
      setNewPost('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 pb-40 w-full">
      {/* Community Status */}
      <section className="bg-charcoal p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-sage/20 blur-[50px] rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sage animate-pulse shadow-[0_0_8px_rgba(125,184,122,0.8)]" />
          </div>
          <div className="flex justify-between items-end border-b border-white/5 pb-6">
            <div className="flex flex-col">
              <div className="text-4xl font-black tracking-tighter leading-none mb-1 font-mono">14.2K</div>
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Suppressed Cravings</div>
            </div>
            <div className="text-right flex flex-col">
              <div className="text-2xl font-black tracking-tighter leading-none mb-1 font-mono text-sage">98%</div>
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Network Uptime</div>
            </div>
          </div>
          
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "82%" }}
              transition={{ duration: 2, delay: 0.5 }}
              className="h-full bg-sage shadow-[0_0_15px_rgba(125,184,122,0.5)]" 
            />
          </div>
          <div className="flex justify-between items-center -mt-2">
             <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Global Resilience Index</span>
             <span className="text-[7px] font-black text-white/60 uppercase tracking-widest">82% Capacity</span>
          </div>

          <p className="text-[10px] text-white/40 font-bold leading-relaxed max-w-[90%] uppercase tracking-widest">
            The community is currently operating at peak protocol levels. Stay vigilant.
          </p>
        </div>
      </section>

      {/* Post Creator */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 flex-shrink-0">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Me" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-gray-300" />
            )}
          </div>
          <textarea 
            placeholder="Log your status..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-charcoal font-bold tracking-tight placeholder:text-gray-300 resize-none min-h-[60px] p-0"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex gap-2">
            <button className="p-2 text-gray-300 hover:text-charcoal bg-gray-50 rounded-lg transition-colors"><ImageIcon size={14} /></button>
            <button className="p-2 text-gray-300 hover:text-charcoal bg-gray-50 rounded-lg transition-colors"><Camera size={14} /></button>
          </div>
          <button 
            onClick={handlePost}
            disabled={posting || !newPost.trim()}
            className="px-6 py-2.5 bg-charcoal text-white rounded-xl text-[9px] font-black uppercase tracking-[0.3em] disabled:opacity-20 transition-all active:scale-95 shadow-xl shadow-charcoal/10"
          >
            {posting ? 'Sending...' : 'Sync Post'}
          </button>
        </div>
      </div>

      {/* Feed Stream */}
      <div className="flex flex-col gap-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} profile={profile} onReport={onReport} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, profile, onReport }: { post: Post, profile: UserProfile, onReport: (id: string, type: 'post' | 'comment' | 'user') => void }) {
  const isLiked = auth.currentUser ? (Array.isArray(post.likes) && post.likes.includes(auth.currentUser.uid)) : false;
  const isOwner = auth.currentUser?.uid === post.userId;

  const handleLike = async () => {
    if (!auth.currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${post.id}`);
    }
  };

  return (
    <motion.div 
      layout
      className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-50 flex flex-col gap-6"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 flex-shrink-0">
            {post.authorPhoto ? (
              <img src={post.authorPhoto} alt={post.authorName} className="w-full h-full object-cover shadow-inner" />
            ) : (
              <User size={24} className="text-gray-300" />
            )}
          </div>
          <div>
            <h4 className="text-[13px] font-black text-charcoal tracking-tight uppercase leading-none mb-1">{post.authorName}</h4>
            <span className="text-[8px] text-gray-300 font-black uppercase tracking-[0.2em] font-mono">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {isOwner && (
            <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
          )}
          <button onClick={() => onReport(post.id, 'post')} className="p-2 text-gray-300 hover:text-charcoal transition-colors"><Flag size={14} /></button>
        </div>
      </div>

      <p className="text-sm text-charcoal leading-relaxed font-bold tracking-tight whitespace-pre-wrap opacity-80">
        {post.content}
      </p>

      {post.imageUrl && (
        <div className="rounded-[32px] overflow-hidden shadow-inner border border-gray-50">
          <img src={post.imageUrl} alt="Post content" className="w-full h-auto" />
        </div>
      )}

      <div className="flex items-center gap-8 pt-6 border-t border-gray-50">
        <button 
          onClick={handleLike}
          className={`flex items-center gap-2.5 transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-gray-300 hover:text-red-500'}`}
        >
          <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={3} />
          <span className="text-[10px] font-black font-mono tracking-widest">{post.likes.length}</span>
        </button>
        
        <button className="flex items-center gap-2.5 text-gray-300 hover:text-charcoal transition-all group">
          <MessageCircle size={20} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black font-mono tracking-widest">{post.commentCount}</span>
        </button>

        <button className="flex items-center gap-2.5 text-gray-300 hover:text-sage transition-all ml-auto group">
          <Repeat size={20} strokeWidth={3} className="group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </motion.div>
  );
}

function MessagesList({ chats, profile, onSelectChat }: { chats: Chat[], profile: UserProfile, onSelectChat: (chat: Chat) => void }) {
  return (
    <div className="flex flex-col p-6 gap-6 w-full pb-32">
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-sage transition-all" size={16} />
        <input 
          type="text" 
          placeholder="Filter transmissions..." 
          className="w-full pl-14 pr-6 py-5 bg-white rounded-[24px] border border-gray-100 shadow-sm text-xs font-bold focus:ring-2 focus:ring-sage/20 transition-all font-mono placeholder:text-gray-300 uppercase tracking-widest"
        />
      </div>

      <div className="flex flex-col gap-4">
        {chats.length === 0 ? (
          <div className="py-24 text-center bg-gray-50/30 border border-dashed border-gray-200 rounded-[48px] flex flex-col items-center gap-6 px-10">
            <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center text-gray-200 shadow-sm border border-gray-50">
              <MessageSquare size={32} strokeWidth={1} />
            </div>
            <div>
              <p className="text-[10px] font-black text-charcoal uppercase tracking-[0.3em] mb-2">Zero Network Activity</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-loose">Establish a link via the main feed to begin direct data exchange.</p>
            </div>
          </div>
        ) : (
          chats.map((chat) => (
            <motion.button 
              key={chat.id} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectChat(chat)}
              className="flex items-center gap-5 p-6 bg-white rounded-[32px] border border-gray-50 shadow-sm hover:shadow-xl transition-all text-left group"
            >
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-[24px] bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:rotate-3 transition-transform">
                  {chat.type === 'dm' ? (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={28} className="text-gray-300" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-sage border-[3px] border-white rounded-full shadow-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <h4 className="text-[13px] font-black text-charcoal tracking-tight truncate uppercase leading-none">
                    {chat.type === 'dm' ? (chat.name || 'ANON_OPERATOR') : chat.name}
                  </h4>
                  <span className="text-[8px] text-gray-300 font-black uppercase tracking-widest font-mono">
                    {chat.lastMessageAt ? formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false }) : ''}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 truncate font-bold opacity-70">
                  {chat.lastMessage || 'CHANNEL_READY...'}
                </p>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}

function ChatView({ chat, profile, onBack }: { chat: Chat, profile: UserProfile, onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, `chats/${chat.id}/messages`), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(newMessages);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chat.id}/messages`));
    return () => unsub();
  }, [chat.id]);

  const handleSend = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    const msg = newMessage;
    setNewMessage('');
    try {
      const msgData = cleanObject({
        chatId: chat.id,
        senderId: auth.currentUser.uid,
        senderName: profile.displayName || auth.currentUser.displayName || 'Anonymous',
        content: msg,
        createdAt: new Date().toISOString(),
        readBy: [auth.currentUser.uid]
      });
      await addDoc(collection(db, `chats/${chat.id}/messages`), msgData);
      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: msg,
        lastMessageAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chat.id}/messages`);
    }
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="flex flex-col h-full bg-white absolute inset-0 z-50 overflow-hidden"
    >
      <header className="px-6 pt-14 pb-6 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-xl sticky top-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 bg-gray-50 rounded-2xl text-gray-400 hover:text-charcoal transition-all active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-charcoal flex items-center justify-center overflow-hidden border border-white shadow-lg text-white font-black text-xs uppercase tracking-tighter">
              {chat.type === 'dm' ? (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                chat.name.slice(0, 2)
              )}
            </div>
            <div>
              <h4 className="text-sm font-black text-charcoal tracking-tight uppercase leading-none mb-1.5">
                {chat.type === 'dm' ? (chat.name || 'SECURE_CHANNEL') : chat.name}
              </h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse shadow-[0_0_8px_#7DB87A]" />
                <span className="text-[9px] text-sage font-black uppercase tracking-[0.2em]">Transmission Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar bg-gray-50/30">
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === auth.currentUser?.uid;
          const showAvatar = idx === 0 || messages[idx-1].senderId !== msg.senderId;
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] ${isMine ? 'ml-auto' : ''}`}>
              {!isMine && showAvatar && (
                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-3 mb-1.5">{msg.senderName}</span>
              )}
              
              <div className={`p-4 rounded-[28px] text-[13px] transition-all leading-relaxed ${
                isMine 
                  ? 'bg-charcoal text-white rounded-br-none shadow-2xl' 
                  : 'bg-white text-charcoal rounded-bl-none card-shadow border border-gray-100 font-medium'
              }`}>
                {msg.content}
              </div>
              <div className={`text-[8px] mt-2 font-black uppercase tracking-widest opacity-30 font-mono ${isMine ? 'text-right pr-2' : 'text-left pl-2'}`}>
                {format(new Date(msg.createdAt), 'HH:mm')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 bg-white border-t border-gray-50 flex gap-4 items-center">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="OPERATIONAL INTEL..."
            className="w-full bg-gray-50 border-gray-100 border rounded-[24px] px-6 py-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-sage/20 focus:ring-4 transition-all placeholder:text-gray-300"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
        </div>
        <button 
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className="w-14 h-14 bg-charcoal text-white rounded-[24px] flex items-center justify-center disabled:opacity-10 transition-all active:scale-90 shadow-xl shadow-charcoal/20"
        >
          <Send size={24} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
}
function Groups({ profile }: { profile: UserProfile }) {
  const [groups, setGroups] = useState<Chat[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userCreatedGroupsCount, setUserCreatedGroupsCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to user's joined groups
    const q = query(
      collection(db, 'chats'), 
      where('type', '==', 'group'), 
      where('participants', 'array-contains', auth.currentUser.uid),
      limit(20)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const newGroups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setGroups(newGroups);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    fetchSuggestions();
    fetchCreatedCount();

    return () => unsub();
  }, [profile]);

  const fetchSuggestions = async () => {
    try {
      const qSug = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        where('participantCount', '>=', 1),
        limit(5)
      );
      const snapshot = await getDocs(qSug);
      const sugs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Chat))
        .filter(g => auth.currentUser && !g.participants.includes(auth.currentUser.uid));
      setSuggestedGroups(sugs);
    } catch (error) {
      console.error("Error fetching suggested groups", error);
    }
  };

  const fetchCreatedCount = async () => {
    if (!auth.currentUser) return;
    try {
      const qCreated = query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(qCreated);
      setUserCreatedGroupsCount(snapshot.size);
    } catch (error) {
      console.error("Error fetching created groups count", error);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'chats', groupId), {
        participants: arrayUnion(auth.currentUser.uid),
        participantCount: increment(1)
      });
      await unlockAchievement('social_join');
      fetchSuggestions();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${groupId}`);
    }
  };

  return (
    <div className="flex flex-col gap-12 p-6 pb-40 w-full">
      {/* Search and Action */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-sage transition-all" size={16} />
          <input 
            type="text" 
            placeholder="Locate clan..." 
            className="w-full pl-14 pr-6 py-5 bg-white rounded-[24px] border border-gray-100 shadow-sm text-xs font-bold focus:ring-2 focus:ring-sage/20 transition-all font-mono placeholder:text-gray-300 uppercase tracking-widest"
          />
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 bg-charcoal text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-charcoal/20 active:scale-95 transition-all"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Suggested Clans */}
      <section>
        <div className="flex items-center gap-3 mb-6 px-2">
          <Sparkles size={14} className="text-sage" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Tactical Recommendations</h3>
        </div>

        <div className="flex flex-col gap-4">
          {suggestedGroups.length === 0 ? (
            <div className="bg-gray-50/30 border border-dashed border-gray-200 rounded-[40px] p-12 text-center">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">No available nodes</p>
            </div>
          ) : (
            suggestedGroups.map((group) => (
              <motion.div 
                key={group.id} 
                className="bg-white border border-gray-50 rounded-[32px] p-6 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[20px] bg-gray-50 flex items-center justify-center text-3xl border border-gray-100 transition-transform group-hover:scale-110">
                    {group.groupType === 'fitness' ? '🏃' : group.groupType === 'productivity' ? '🧠' : group.groupType === 'learning' ? '📚' : '🚭'}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-charcoal tracking-tight leading-none mb-1.5 uppercase">{group.name}</h4>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest font-mono">
                      {group.participantCount || 0} OPERATIVES
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleJoinGroup(group.id)}
                  className="px-6 py-3 bg-charcoal text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-sage transition-all active:scale-95"
                >
                  Join
                </button>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* My Clans */}
      <section>
        <div className="flex items-center gap-3 mb-6 px-2">
          <Users size={14} className="text-gray-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Authorized Channels</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {groups.length === 0 ? (
            <div className="col-span-2 py-14 text-center bg-gray-50/30 rounded-[40px] border border-dashed border-gray-200">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Zero active affiliations</p>
            </div>
          ) : (
            groups.map((group) => (
              <motion.div 
                key={group.id} 
                whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" }}
                className="bg-white border border-gray-50 rounded-[32px] p-6 shadow-sm transition-all cursor-pointer group flex flex-col h-full items-center text-center"
              >
                <div className="w-14 h-14 bg-gray-50 rounded-[20px] flex items-center justify-center text-gray-300 mb-6 group-hover:bg-charcoal group-hover:text-white transition-all transform group-hover:rotate-3 shadow-inner">
                  <Users size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-[11px] font-black text-charcoal tracking-tight uppercase mb-2 line-clamp-2 leading-tight">{group.name}</h4>
                  <div className="flex items-center justify-center">
                    <span className="text-[8px] font-black text-sage uppercase tracking-widest leading-none font-mono">
                      {group.participantCount || 0} ACTIVE
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      <AnimatePresence>
        {showCreateModal && (
          <CreateGroupModal 
            onClose={() => setShowCreateModal(false)} 
            createdCount={userCreatedGroupsCount}
            onCreated={() => {
              fetchCreatedCount();
              setShowCreateModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateGroupModal({ onClose, createdCount, onCreated }: { onClose: () => void, createdCount: number, onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'support' | 'fitness' | 'productivity' | 'learning' | 'other'>('support');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = createdCount < 3;

  const categories = [
    { id: 'support', label: 'Support', icon: '🚭', color: 'bg-sage' },
    { id: 'fitness', label: 'Fitness', icon: '🏃', color: 'bg-blue' },
    { id: 'productivity', label: 'Focus', icon: '🧠', color: 'bg-orange-500' },
    { id: 'learning', label: 'Learn', icon: '📚', color: 'bg-purple-500' },
    { id: 'other', label: 'Other', icon: '✨', color: 'bg-gray-400' },
  ];

  const handleCreate = async () => {
    if (!name.trim() || !auth.currentUser || !canCreate) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'chats'), cleanObject({
        type: 'group',
        name,
        description,
        groupType: type,
        ownerId: auth.currentUser.uid,
        participants: [auth.currentUser.uid],
        participantCount: 1,
        createdAt: new Date().toISOString(),
        lastMessage: 'Group initialized.',
        lastMessageAt: new Date().toISOString()
      }));
      onCreated();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-charcoal/40 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-sm rounded-[40px] p-8 border border-gray-100 shadow-2xl relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-charcoal" />
        
        <header className="mb-8">
          <h3 className="text-xl font-black text-charcoal tracking-tight mb-2 uppercase">Core Initialization</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Protocol Delta-9 Community</p>
        </header>

        {!canCreate ? (
          <div className="bg-red-50 p-6 rounded-[32px] border border-red-100 text-center mb-8">
            <Shield size={24} className="text-red-500 mx-auto mb-3" />
            <p className="text-xs font-black text-red-900 uppercase tracking-widest mb-1">Resource Limit</p>
            <p className="text-[10px] text-red-700/60 font-bold uppercase leading-relaxed font-mono">Maximum 3 active segments allowed per operator.</p>
          </div>
        ) : (
          <div className="space-y-8 mb-10">
            <div className="grid grid-cols-5 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setType(cat.id as any)}
                  className={`flex flex-col items-center gap-2 transition-all ${type === cat.id ? 'scale-110' : 'opacity-40 grayscale blur-[0.5px]'}`}
                >
                  <div className={`w-12 h-12 ${cat.color} rounded-2xl flex items-center justify-center text-xl shadow-lg border-2 border-white`}>
                    {cat.icon}
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-charcoal font-mono">{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-charcoal transition-colors">Segment Designation</label>
                <input 
                  type="text" 
                  placeholder="ID_MORNING_RITUAL"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-charcoal/5 focus:border-gray-200 transition-all font-medium placeholder:text-gray-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-charcoal transition-colors">Mission Briefing</label>
                <textarea 
                  placeholder="Define operational objectives..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm focus:ring-4 focus:ring-charcoal/5 focus:border-gray-200 transition-all font-medium resize-none h-24 placeholder:text-gray-200"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-charcoal transition-colors"
          >
            Abort
          </button>
          {canCreate && (
            <button 
              onClick={handleCreate}
              disabled={submitting || !name.trim()}
              className="flex-3 py-4 bg-charcoal text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-sage transition-all active:scale-95 shadow-xl shadow-charcoal/20 disabled:opacity-20"
            >
              {submitting ? 'PROCESSING...' : 'INITIALIZE SEGMENT'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function UserProfileView({ profile }: { profile: UserProfile }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile.bio || '');
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        bio,
        displayName
      });
      setEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const selectAvatar = async (url: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        photoURL: url
      });
      setShowAvatarPicker(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const stats = [
    { label: 'Uptime', value: profile.quitDate ? formatDistanceToNow(new Date(profile.quitDate)).split(' ')[0] : '12', icon: <Sparkles size={16} /> },
    { label: 'Cash', value: '$2,480', icon: <Heart size={16} /> },
    { label: 'Integrity', value: '98%', icon: <Shield size={16} /> },
  ];

  return (
    <div className="flex flex-col gap-10 p-6 pb-24 max-w-lg mx-auto w-full">
      {/* Profile Card */}
      <section className="relative bg-charcoal rounded-[40px] p-8 text-white overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-sage/20 blur-[60px] rounded-full -mr-24 -mt-24" />
        
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-[32px] bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 backdrop-blur-md">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={40} className="text-white/10" />
              )}
            </div>
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="absolute -bottom-1 -right-1 w-10 h-10 bg-white text-charcoal rounded-xl shadow-lg border-4 border-charcoal flex items-center justify-center hover:scale-105 transition-transform"
            >
              <Camera size={16} />
            </button>
          </div>

          <div className="w-full space-y-3">
            {editing ? (
              <div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-xl font-black text-center focus:ring-2 focus:ring-sage w-full text-white"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
                <textarea 
                  className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-center focus:ring-2 focus:ring-sage w-full text-white/70 resize-none h-20"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Operational briefing..."
                />
                <div className="flex gap-2 justify-center pt-2">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/40">Abort</button>
                  <button onClick={handleSave} className="px-5 py-2 bg-white text-charcoal rounded-lg text-[10px] font-black uppercase tracking-widest">Commit</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-black tracking-tight mb-0.5">{profile.displayName || 'UNNAMED_OPERATOR'}</h2>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-1 h-1 bg-sage rounded-full animate-pulse" />
                    <span className="text-[9px] text-sage font-black uppercase tracking-widest">Tier 3 Protocol Specialist</span>
                  </div>
                </div>
                <p className="text-xs text-white/60 font-medium leading-relaxed max-w-[240px] mx-auto opacity-80">
                  {profile.bio || "No tactical briefing found. Update profile parameters."}
                </p>
                <button 
                  onClick={() => setEditing(true)}
                  className="mt-4 px-5 py-2 bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Edit Profile
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 w-full pt-8 border-t border-white/10">
            {stats.map((stat, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-base font-black text-white font-mono">{stat.value}</span>
                <span className="text-[8px] text-white/40 uppercase tracking-widest font-black mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 text-center">Operational Milestones</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: '🌱', label: 'Day 01', color: 'bg-green-500' },
            { icon: '⚔️', label: 'Combat', color: 'bg-blue-500' },
            { icon: '🏅', label: 'Elite', color: 'bg-yellow-500' },
            { icon: '♾️', label: 'Iron', color: 'bg-charcoal' },
          ].map((ach) => (
            <div key={ach.label} className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 ${ach.color} rounded-2xl flex items-center justify-center text-xl shadow-lg border-2 border-white`}>
                {ach.icon}
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 font-mono">{ach.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AvatarPicker({ onClose, onSelect }: { onClose: () => void, onSelect: (url: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-charcoal/40 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-2xl max-w-sm w-full"
      >
        <h3 className="text-xl font-black text-charcoal tracking-tight mb-8 uppercase text-center">Identity Override</h3>
        <div className="grid grid-cols-3 gap-6">
          {DEFAULT_AVATARS.map((url, i) => (
            <button 
              key={i} 
              onClick={() => onSelect(url)}
              className="relative aspect-square rounded-[24px] overflow-hidden border-2 border-transparent hover:border-charcoal hover:scale-105 transition-all shadow-sm group"
            >
              <img src={url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/10 transition-colors" />
            </button>
          ))}
        </div>
        <button 
          onClick={onClose}
          className="w-full mt-10 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

function ReportModal({ targetId, targetType, onClose }: { targetId: string, targetType: 'post' | 'comment' | 'user', onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || !auth.currentUser) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), cleanObject({
        reporterId: auth.currentUser.uid,
        targetId,
        targetType,
        reason,
        createdAt: new Date().toISOString(),
        status: 'pending'
      }));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-charcoal/40 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-sm rounded-[32px] p-8 border border-gray-100 shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
        
        <h3 className="text-xl font-black text-charcoal mb-2 tracking-tight">REPORT CONTENT</h3>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">Security & Enforcement</p>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed font-medium">Please describe the policy violation clearly for the moderation team.</p>
        
        <textarea
          placeholder="Detailed reason for reporting..."
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm resize-none min-h-[140px] mb-6 focus:ring-2 focus:ring-red-500/10 focus:border-red-500/20 transition-all placeholder:text-gray-200 font-medium"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-[2] py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-500/20"
          >
            {submitting ? 'PROCESSING...' : 'SUBMIT REPORT'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
