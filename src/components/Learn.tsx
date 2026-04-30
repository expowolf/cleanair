import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Zap, Wind, Heart, Brain, ChevronRight, Play, Star, Shield, ArrowRight } from 'lucide-react';

const ARTICLES = [
  {
    id: 'dopamine',
    title: 'The Dopamine Trap',
    category: 'Biology',
    readTime: '4 min',
    icon: <Brain className="text-purple-500" size={20} />,
    description: 'Understanding how nicotine hijacks your brain\'s reward system and how to take it back.'
  },
  {
    id: 'sleep',
    title: 'Restoring Sleep Patterns',
    category: 'Recovery',
    readTime: '3 min',
    icon: <Wind className="text-blue" size={20} />,
    description: 'Why nicotine disrupts REM cycles and tips for getting your deep rest back during withdrawal.'
  },
  {
    id: 'triggers',
    title: 'Trigger Mapping 101',
    category: 'Strategy',
    readTime: '5 min',
    icon: <Zap className="text-orange" size={20} />,
    description: 'Identifying the hidden environmental cues that drive your cravings.'
  }
];

const FACTS = [
  { q: "Vaping is 100% safe compared to smoking", a: "False. While it lacks many combustion toxins, it introduces heavy metals and ultrafine particles into lung tissue.", status: 'myth' },
  { q: "Nicotine stays in your blood for months", a: "False. Most nicotine is cleared within 48-72 hours. Withdrawal after that is purely psychological.", status: 'fact' },
  { q: "Cravings only last 5-10 minutes", a: "True. While they feel eternal, the physical peak of an urge is actually very short-lived.", status: 'fact' }
];

export default function Learn() {
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-10 pb-32">
      <header className="px-6 pt-10 pb-4 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-sage rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
          <BookOpen size={24} />
        </div>
        <h1 className="text-3xl font-black text-charcoal tracking-tight">KNOWLEDGE BASE</h1>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1.5">Intelligence for the Recovery Front</p>
      </header>

      {/* Featured Lesson */}
      <section className="px-6">
        <div className="bg-charcoal p-8 rounded-[40px] text-white overflow-hidden relative shadow-2xl group cursor-pointer active:scale-95 transition-all">
          <div className="absolute top-0 right-0 w-48 h-48 bg-sage/20 blur-[60px] rounded-full -mr-24 -mt-24 opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Star className="text-sage" size={16} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Featured Module</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-3">RECOVERY TIMELINE</h2>
            <p className="text-xs text-white/60 font-medium leading-relaxed max-w-[240px] mb-8">
              A comprehensive blueprint of what happens to your biological system from hour 1 to year 10.
            </p>
            <div className="flex items-center gap-3 text-sage font-black text-[10px] uppercase tracking-widest">
              Launch Simulation <Play size={10} fill="currentColor" />
            </div>
          </div>
        </div>
      </section>

      {/* Education Stream */}
      <section className="px-6">
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Intel Briefings</h3>
          <ArrowRight className="text-gray-300" size={14} />
        </div>
        
        <div className="flex flex-col gap-4">
          {ARTICLES.map((article) => (
            <motion.div
              key={article.id}
              whileHover={{ x: 4 }}
              className="bg-white p-6 rounded-[32px] border border-gray-50 card-shadow flex items-center gap-5 group cursor-pointer"
            >
              <div className="w-14 h-14 bg-gray-50 rounded-[20px] flex items-center justify-center shadow-inner group-hover:bg-white transition-colors">
                {article.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-sage">{article.category}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">• {article.readTime}</span>
                </div>
                <h4 className="text-[13px] font-black text-charcoal tracking-tight uppercase leading-none">{article.title}</h4>
              </div>
              <ChevronRight className="text-gray-200 group-hover:text-sage transition-colors" size={20} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Myth vs Fact */}
      <section className="px-6">
        <div className="bg-sage/5 p-8 rounded-[48px] border border-sage/10">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="text-sage" size={20} />
            <h3 className="text-[10px] font-black text-sage uppercase tracking-[0.3em]">Truth Protocol</h3>
          </div>
          
          <div className="flex flex-col gap-8">
            {FACTS.map((f, i) => (
              <div key={i} className="flex flex-col gap-3 group">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black ${f.status === 'myth' ? 'bg-red-500/10 text-red-500' : 'bg-sage/10 text-sage'}`}>
                    {f.status === 'myth' ? 'M' : 'F'}
                  </div>
                  <p className="text-[11px] font-black text-charcoal tracking-tight uppercase leading-relaxed mt-1.5">{f.q}</p>
                </div>
                <div className="ml-12 p-5 bg-white rounded-3xl border border-sage/5 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium leading-relaxed opacity-80">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="px-6 pb-12">
        <div className="bg-orange p-10 rounded-[48px] text-white text-center shadow-2xl relative overflow-hidden">
          <Zap className="absolute -bottom-8 -left-8 text-white/10 w-40 h-40 transform -rotate-12" />
          <h3 className="text-2xl font-black tracking-tight mb-4 uppercase relative z-10">Knowledge is Power</h3>
          <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-loose mb-10 relative z-10">
            The more science you know, the less control nicotine has. Build your mental arsenal.
          </p>
          <button className="w-full py-5 bg-white text-orange rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl relative z-10 active:scale-95 transition-all">
            Unlock Full Academy
          </button>
        </div>
      </section>
    </div>
  );
}
