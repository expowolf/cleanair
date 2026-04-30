import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Legal from './Legal';
import { 
  User as UserIcon,
  Mail,
  Lock,
  LogOut,
  Trash2,
  Camera,
  ChevronRight,
  Settings as SettingsIcon,
  Target,
  Zap,
  Clock,
  DollarSign,
  Shield,
  Bell,
  Check,
  ArrowLeft,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { UserProfile, ProgressSnapshot, OperationType, NicotineType, UsageHabits, Trigger, QuitMethod } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, cleanObject } from '../lib/firestore';
import { format } from 'date-fns';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie'
];

interface DashboardProps {
  profile: UserProfile;
}

type SettingsSection = 'main' | 'account' | 'profile' | 'personalization' | 'notifications' | 'privacy' | 'appearance' | 'help' | 'about';

export default function Dashboard({ profile }: DashboardProps) {
  const [section, setSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const navigate = useNavigate();
  
  // Form States
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [email, setEmail] = useState(profile.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Settings States
  const [settings, setSettings] = useState(profile.settings || {
    notifications: { cravings: true, community: true, milestones: true, planUpdates: true, marketing: false },
    privacy: { publicProfile: true, showStreak: true, showProgress: true, allowMessages: true },
    appearance: { theme: 'system', compactMode: false, highContrast: false },
    units: { currency: 'USD', dateFormat: 'MM/DD/YYYY' }
  });

  // Personalization States
  const [nicotineType, setNicotineType] = useState(profile.nicotineType);
  const [usageHabits, setUsageHabits] = useState(profile.usageHabits);
  const [triggers, setTriggers] = useState<string[]>(profile.triggers || []);
  const [quitMethod, setQuitMethod] = useState(profile.quitMethod);
  const [weeklySpend, setWeeklySpend] = useState(profile.weeklySpend);
  const [whyIQuit, setWhyIQuit] = useState(profile.whyIQuit);
  const [motivationLevel, setMotivationLevel] = useState(profile.motivationLevel);
  const [routineStyle, setRoutineStyle] = useState(profile.routineStyle);

  const [showLegal, setShowLegal] = useState<'privacy' | 'terms' | null>(null);

  const handleUpdateSettings = async (updatedSettings: any) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        settings: updatedSettings
      });
      setSettings(updatedSettings);
      setMessage({ type: 'success', text: 'Settings updated!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), cleanObject({
        displayName,
        bio
      }));
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setSection('main'), 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      if (email !== profile.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }
      if (newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { email });
      setMessage({ type: 'success', text: 'Account updated successfully!' });
      setNewPassword('');
      setTimeout(() => setSection('main'), 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePersonalization = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), cleanObject({
        nicotineType,
        usageHabits,
        triggers,
        quitMethod,
        weeklySpend,
        whyIQuit,
        motivationLevel,
        routineStyle
      }));
      setMessage({ type: 'success', text: 'Protocol updated! Your plan is being recalibrated...' });
      
      // Trigger plan recalculation (in a real app, this might be a cloud function or a specific flag)
      // For now, we'll just set a flag that QuitPlan can pick up
      await updateDoc(doc(db, 'plans', auth.currentUser.uid), { status: 'adjusting' });
      
      setTimeout(() => setSection('main'), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      setMessage({ type: 'error', text: 'Failed to update personalization.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || !window.confirm("Are you absolutely sure? This will delete all your data permanently.")) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'plans', uid));
      await deleteDoc(doc(db, 'progress', uid));
      await supabase.auth.signOut();
      setMessage({ type: 'success', text: 'Account data deleted. Contact support to fully remove your auth record.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const selectAvatar = async (url: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: url });
      setShowAvatarPicker(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const SettingsRow = ({ icon: Icon, label, sub, onClick, color = "text-gray-400" }: any) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-all border-b border-gray-50 last:border-none group text-left"
    >
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-xl bg-gray-50 group-hover:bg-white transition-all ${color}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div>
          <span className="block text-sm font-black text-charcoal tracking-tight mb-0.5 uppercase leading-none">{label}</span>
          <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">{sub}</span>
        </div>
      </div>
      <ChevronRight size={16} className="text-gray-200 group-hover:translate-x-1 transition-transform" />
    </button>
  );

  const renderMain = () => (
    <div className="flex flex-col gap-10">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mt-4">
        <div className="relative group">
          <div className="w-32 h-32 rounded-[48px] bg-charcoal overflow-hidden shadow-2xl relative border-4 border-white mb-6 p-1">
             <div className="w-full h-full rounded-[40px] overflow-hidden bg-gray-100 flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={48} className="text-gray-300" />
              )}
            </div>
            <button 
              onClick={() => setSection('profile')}
              className="absolute bottom-2 right-2 bg-sage text-white p-2.5 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"
            >
              <Camera size={16} />
            </button>
          </div>
        </div>
        <h2 className="text-3xl font-black text-charcoal tracking-tight leading-none uppercase">{profile.displayName || 'Operative'}</h2>
        <div className="flex items-center gap-2 mt-2 justify-center">
          <div className="px-2 py-0.5 bg-sage/10 rounded flex items-center gap-1">
            <Shield size={10} className="text-sage" />
            <span className="text-[10px] font-black text-sage uppercase tracking-widest leading-none">Protocol Verified</span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Joined {profile.quitDate ? format(new Date(profile.quitDate), 'MMM yyyy') : 'Unknown'}</p>
        </div>
      </div>

      {/* Premium Upgrade */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-charcoal p-8 rounded-[48px] text-white relative overflow-hidden shadow-2xl border border-white/5"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-sage/20 blur-[60px] rounded-full -mr-20 -mt-20 opacity-60" />
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-sage" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">CleanAIr Elite</span>
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight leading-none mb-1 uppercase">Upgrade Protocol</h3>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Unlock Elite Recovery Monitoring</p>
          </div>
          <button className="w-full py-4 bg-sage text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-sage/20 hover:bg-white hover:text-sage transition-all">
            Unlock Full Potential
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Identity', icon: UserIcon, section: 'profile', sub: 'Bio & Protocol' },
          { label: 'Security', icon: Lock, section: 'account', sub: 'Portal Access' },
          { label: 'Logic', icon: Zap, section: 'personalization', sub: 'Trigger Analysis' },
          { label: 'Pings', icon: Bell, section: 'notifications', sub: 'Alert Config' }
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => setSection(item.section as any)}
            className="flex flex-col p-6 bg-white rounded-[40px] card-shadow border border-gray-50 text-left gap-4 hover:border-sage/20 transition-all group active:scale-95"
          >
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-sage transition-colors">
              <item.icon size={22} />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-charcoal uppercase tracking-widest mb-1">{item.label}</h4>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest opacity-60 leading-none">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <MenuButton icon={<Shield className="text-blue" size={20} />} label="Legal & Privacy" sub="Protocol Regulations" onClick={() => setShowLegal('privacy')} />
        <MenuButton icon={<Mail className="text-sage" size={20} />} label="Help Center" sub="Network Interventions" onClick={() => setSection('help')} />
        
        <button
          onClick={handleLogout}
          className="w-full py-5 bg-red-50 text-red-500 rounded-[32px] font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 active:scale-95 transition-all mt-4 border border-red-100"
        >
          <LogOut size={16} /> Terminate Connection
        </button>
      </div>

      <footer className="text-center pb-8 mt-4">
        <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.5em]">CleanAIr v2.4.9</p>
      </footer>
    </div>
  );

  const renderProfile = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Profile Settings</h2>
      </div>

      <div className="flex flex-col items-center gap-4 mb-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-sage/10 flex items-center justify-center overflow-hidden border-4 border-white card-shadow">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={48} className="text-sage" />
            )}
          </div>
          <button 
            onClick={() => setShowAvatarPicker(true)}
            className="absolute bottom-0 right-0 p-2 bg-sage text-white rounded-full card-shadow border-2 border-white"
          >
            <Camera size={14} />
          </button>
        </div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Tap to change avatar</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Display Name</label>
          <input 
            type="text" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full p-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Bio</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the community about your journey..."
            className="w-full p-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none h-32 resize-none"
          />
        </div>

        <button
          onClick={handleUpdateProfile}
          disabled={loading}
          className="w-full py-4 bg-sage text-white rounded-full font-bold card-shadow active:scale-95 transition-transform mt-4 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Save Changes</>}
        </button>
      </div>

      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="bg-white p-8 rounded-[32px] card-shadow w-full max-w-sm">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">Choose an Avatar</h3>
              <div className="grid grid-cols-3 gap-4">
                {DEFAULT_AVATARS.map((url, i) => (
                  <button 
                    key={i} 
                    onClick={() => selectAvatar(url)}
                    className="w-full aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-sage transition-all"
                  >
                    <img src={url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowAvatarPicker(false)}
                className="w-full mt-8 py-3 text-sm font-bold text-gray-400"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderAccount = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Account Settings</h2>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full pl-12 pr-4 py-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleUpdateAccount}
          disabled={loading}
          className="w-full py-4 bg-orange text-white rounded-full font-bold card-shadow active:scale-95 transition-transform mt-4 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Update Account</>}
        </button>
      </div>
    </div>
  );

  const renderPersonalization = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Personalization</h2>
      </div>

      <div className="bg-sage/5 p-4 rounded-[24px] border border-sage/10 flex items-start gap-3 mb-2">
        <Zap className="text-sage mt-1" size={18} />
        <p className="text-xs text-sage-900 leading-relaxed">
          Updating these settings will recalibrate your daily tasks and recovery responses.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Nicotine Type */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nicotine Source</label>
          <div className="grid grid-cols-2 gap-2">
            {['Vape', 'Cigarettes', 'Both', 'Other'].map(type => (
              <button 
                key={type}
                onClick={() => setNicotineType(type as NicotineType)}
                className={`py-3 rounded-2xl text-xs font-bold transition-all ${nicotineType === type ? 'bg-sage text-white' : 'bg-white card-shadow text-gray-500'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Triggers */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Triggers</label>
          <div className="grid grid-cols-2 gap-2">
            {['Stress', 'Boredom', 'Social situations', 'After meals', 'Morning routine', 'Anxiety'].map(trigger => (
              <button 
                key={trigger}
                onClick={() => {
                  if (triggers.includes(trigger)) {
                    setTriggers(triggers.filter(t => t !== trigger));
                  } else {
                    setTriggers([...triggers, trigger]);
                  }
                }}
                className={`py-3 rounded-2xl text-[10px] font-bold transition-all ${triggers.includes(trigger) ? 'bg-sage text-white' : 'bg-white card-shadow text-gray-500'}`}
              >
                {trigger}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Spend */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Weekly Spend ($)</label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="number" 
              value={weeklySpend} 
              onChange={(e) => setWeeklySpend(Number(e.target.value))}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none"
            />
          </div>
        </div>

        {/* Why I Quit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">My Why</label>
          <textarea 
            value={whyIQuit} 
            onChange={(e) => setWhyIQuit(e.target.value)}
            className="w-full p-4 bg-white rounded-[20px] card-shadow text-sm focus:ring-2 focus:ring-sage outline-none h-24 resize-none italic"
          />
        </div>

        {/* Routine Style */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Routine Style</label>
          <div className="flex gap-2">
            {['Strict', 'Flexible'].map(style => (
              <button 
                key={style}
                onClick={() => setRoutineStyle(style as any)}
                className={`flex-1 py-3 rounded-2xl text-xs font-bold transition-all ${routineStyle === style ? 'bg-sage text-white' : 'bg-white card-shadow text-gray-500'}`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleUpdatePersonalization}
          disabled={loading}
          className="w-full py-4 bg-sage text-white rounded-full font-bold card-shadow active:scale-95 transition-transform mt-4 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <><Zap size={20} /> Update My Plan</>}
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Notifications</h2>
      </div>

      <div className="bg-white rounded-[32px] card-shadow divide-y divide-gray-50 overflow-hidden">
        <ToggleRow 
          label="Cravings Alerts" 
          desc="Reminders and strategies when cravings spike" 
          active={settings.notifications.cravings} 
          onToggle={() => handleUpdateSettings({ ...settings, notifications: { ...settings.notifications, cravings: !settings.notifications.cravings } })}
        />
        <ToggleRow 
          label="Community Interactivity" 
          desc="Likes, comments, and mentions on your posts" 
          active={settings.notifications.community} 
          onToggle={() => handleUpdateSettings({ ...settings, notifications: { ...settings.notifications, community: !settings.notifications.community } })}
        />
        <ToggleRow 
          label="Milestones & Streak" 
          desc="Congrats when you hit new quit targets" 
          active={settings.notifications.milestones} 
          onToggle={() => handleUpdateSettings({ ...settings, notifications: { ...settings.notifications, milestones: !settings.notifications.milestones } })}
        />
        <ToggleRow 
          label="Plan Updates" 
          desc="When the system optimizes your daily route" 
          active={settings.notifications.planUpdates} 
          onToggle={() => handleUpdateSettings({ ...settings, notifications: { ...settings.notifications, planUpdates: !settings.notifications.planUpdates } })}
        />
        <ToggleRow 
          label="Marketing & Feedback" 
          desc="Occasional news and product surveys" 
          active={settings.notifications.marketing} 
          onToggle={() => handleUpdateSettings({ ...settings, notifications: { ...settings.notifications, marketing: !settings.notifications.marketing } })}
        />
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Privacy</h2>
      </div>

      <div className="bg-white rounded-[32px] card-shadow divide-y divide-gray-50 overflow-hidden">
        <ToggleRow 
          label="Public Profile" 
          desc="Allow others to see your bio and achievements" 
          active={settings.privacy.publicProfile} 
          onToggle={() => handleUpdateSettings({ ...settings, privacy: { ...settings.privacy, publicProfile: !settings.privacy.publicProfile } })}
        />
        <ToggleRow 
          label="Show Quit Streak" 
          desc="Display your total days quit on profile" 
          active={settings.privacy.showStreak} 
          onToggle={() => handleUpdateSettings({ ...settings, privacy: { ...settings.privacy, showStreak: !settings.privacy.showStreak } })}
        />
        <ToggleRow 
          label="Show Progress" 
          desc="Allow friends to see your journey metrics" 
          active={settings.privacy.showProgress} 
          onToggle={() => handleUpdateSettings({ ...settings, privacy: { ...settings.privacy, showProgress: !settings.privacy.showProgress } })}
        />
        <ToggleRow 
          label="Direct Messaging" 
          desc="Allow people to contact you directly" 
          active={settings.privacy.allowMessages} 
          onToggle={() => handleUpdateSettings({ ...settings, privacy: { ...settings.privacy, allowMessages: !settings.privacy.allowMessages } })}
        />
      </div>
      
      <div className="p-4 bg-gray-50 rounded-[20px] text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Data Security</p>
        <p className="text-[10px] text-gray-400 font-medium">Your biometric and clinical data is encrypted and never shared with 3rd parties.</p>
      </div>
    </div>
  );

  const renderAppearance = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Appearance</h2>
      </div>

      <div className="bg-white rounded-[32px] card-shadow p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {['light', 'dark', 'system'].map(t => (
              <button 
                key={t}
                onClick={() => handleUpdateSettings({ ...settings, appearance: { ...settings.appearance, theme: t } })}
                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.appearance.theme === t ? 'bg-charcoal text-white' : 'bg-gray-50 text-gray-400'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-50 -mx-6">
          <ToggleRow 
            label="Compact Mode" 
            desc="Smaller text and tighter components" 
            active={settings.appearance.compactMode} 
            onToggle={() => handleUpdateSettings({ ...settings, appearance: { ...settings.appearance, compactMode: !settings.appearance.compactMode } })}
          />
          <ToggleRow 
            label="High Contrast" 
            desc="Easier viewing for some users" 
            active={settings.appearance.highContrast} 
            onToggle={() => handleUpdateSettings({ ...settings, appearance: { ...settings.appearance, highContrast: !settings.appearance.highContrast } })}
          />
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Region & Units</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-gray-400 ml-1">CURRENCY</span>
              <select 
                value={settings.units.currency}
                onChange={(e) => handleUpdateSettings({ ...settings, units: { ...settings.units, currency: e.target.value } })}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-gray-400 ml-1">DATE FORMAT</span>
              <select 
                value={settings.units.dateFormat}
                onChange={(e) => handleUpdateSettings({ ...settings, units: { ...settings.units, dateFormat: e.target.value } })}
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-xs font-bold"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="flex flex-col gap-8 text-center pt-12 items-center px-8">
      <div className="w-24 h-24 bg-sage/10 rounded-[40px] flex items-center justify-center text-sage shadow-inner">
        <Zap size={48} />
      </div>
      <div>
        <h2 className="text-2xl font-black text-charcoal tracking-tight uppercase leading-none">CleanAIr</h2>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.4em] mt-2">Operational Framework</p>
      </div>
      
      <div className="w-full bg-white rounded-[32px] border border-gray-50 p-6 flex flex-col gap-4 text-left shadow-sm">
        <div className="flex justify-between items-center py-2 border-b border-gray-50">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Version</span>
          <span className="text-xs font-mono font-bold text-charcoal">v12.4.0 (STABLE)</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-50">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Node ID</span>
          <span className="text-xs font-mono font-bold text-charcoal">US-DELTA-7</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compiler</span>
          <span className="text-xs font-mono font-bold text-charcoal">Protocol-G3</span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-widest">
          Created to empower individuals in their journey toward freedom through advanced neural intelligence and community support.
        </p>
        <p className="text-[9px] text-sage font-black uppercase tracking-[0.2em]">© 2026 CleanAIr Protocol LLC.</p>
      </div>
      
      <button 
        onClick={() => setSection('main')}
        className="mt-4 px-8 py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-charcoal transition-all"
      >
        Back to Dashboard
      </button>
    </div>
  );

  const renderHelp = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => setSection('main')} className="p-2 bg-white rounded-full card-shadow text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-charcoal">Help & FAQ</h2>
      </div>

      <div className="flex flex-col gap-4">
        {[
          { q: "How does the plan work?", a: "Our system analyzes your personal triggers and usage frequency to build a schedule that minimizes cravings while building long-term resilience." },
          { q: "What is a 'Recovery Log'?", a: "Tracking every urge helps identify patterns. The protocol uses this data to refine your 'Next Steps' and provide better real-time tools." },
          { q: "Can I use NRT with this?", a: "Yes! There's a section in Personalization to track your Nicotine Replacement Therapy progress." },
          { q: "Is my data private?", a: "Absolutely. We are SOC2 compliant and your clinical data is siloed from social community data." }
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] card-shadow border border-gray-50">
            <h4 className="text-sm font-bold text-charcoal mb-2">{item.q}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
          </div>
        ))}

        <div className="bg-white rounded-[32px] border border-gray-50 overflow-hidden shadow-sm mt-4">
          <SettingsRow icon={Shield} label="Privacy Policy" sub="Read our data terms" onClick={() => setShowLegal('privacy')} />
          <SettingsRow icon={Mail} label="Contact Support" sub="Get elite assistance" onClick={() => window.open('mailto:support@cleanair.app', '_blank')} />
          <SettingsRow icon={Zap} label="Terms of Service" sub="App protocol rules" onClick={() => setShowLegal('terms')} />
        </div>

        <div className="mt-4 p-8 bg-sage/5 rounded-[40px] border border-dashed border-sage/20 text-center">
          <p className="text-xs font-bold text-sage mb-2">Need direct intervention?</p>
          <button className="px-10 py-4 bg-sage text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-sage/20 active:scale-95 transition-all">
            Chat with a Guide
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col px-6 pb-40 pt-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {section === 'main' && renderMain()}
          {section === 'profile' && renderProfile()}
          {section === 'account' && renderAccount()}
          {section === 'personalization' && renderPersonalization()}
          {section === 'notifications' && renderNotifications()}
          {section === 'privacy' && renderPrivacy()}
          {section === 'appearance' && renderAppearance()}
          {section === 'help' && renderHelp()}
          {section === 'about' && renderAbout()}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showLegal && (
          <Legal type={showLegal} onClose={() => setShowLegal(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-6 right-6 p-4 rounded-2xl card-shadow z-[110] flex items-center gap-3 ${
              message.type === 'success' ? 'bg-sage text-white' : 'bg-secondary text-white'
            }`}
          >
            {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold">{message.text}</p>
            <button onClick={() => setMessage(null)} className="ml-auto opacity-70">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-6 group active:bg-gray-50/50 transition-colors">
      <div className="flex-1 pr-4">
        <h4 className="text-sm font-bold text-charcoal mb-0.5">{label}</h4>
        <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${active ? 'bg-sage shadow-inner shadow-black/10' : 'bg-gray-200 shadow-inner'}`}
      >
        <motion.div 
          animate={{ x: active ? 24 : 4 }}
          className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
        />
      </button>
    </div>
  );
}

function MenuButton({ icon, label, sub, onClick }: { icon: React.ReactNode, label: string, sub: string, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white p-4 rounded-[24px] card-shadow flex items-center gap-4 active:scale-[0.98] transition-all"
    >
      <div className="p-3 bg-gray-50 rounded-2xl">
        {icon}
      </div>
      <div className="flex-1 text-left">
        <h4 className="text-sm font-bold text-charcoal">{label}</h4>
        <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
      </div>
      <ChevronRight size={18} className="text-gray-300" />
    </button>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return <Zap className={`${className} animate-pulse`} size={size} />;
}

