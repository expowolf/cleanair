import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Lock, Scale, ChevronRight } from 'lucide-react';

interface LegalProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

export default function Legal({ type, onClose }: LegalProps) {
  const content = type === 'privacy' 
    ? {
        title: 'Privacy Policy',
        subtitle: 'Protocol Delta-9 Privacy Statement',
        icon: <Shield size={32} />,
        sections: [
          {
            title: '1. Data Collection',
            body: 'We collect biometric data, usage patterns, and emotional state logs to provide personalized recovery support. This data is encrypted at rest and in transit.'
          },
          {
            title: '2. Recovery Analysis',
            body: 'Our local logic nodes process your data locally where possible. Aggregated, de-identified data may be used to improve the global recovery protocol algorithm.'
          },
          {
            title: '3. Community Data',
            body: 'Posts and messages in public clans are visible to other operatives. Your private messages are end-to-end encrypted and never accessible by CleanAIr staff.'
          },
          {
            title: '4. Third Party Integration',
            body: 'We do not sell your data. We only share information with verified infrastructure partners (Firebase, Google Cloud) as required for operational uptime.'
          }
        ]
      }
    : {
        title: 'Terms of Service',
        subtitle: 'Operative Conduct Agreement',
        icon: <Scale size={32} />,
        sections: [
          {
            title: '1. Usage License',
            body: 'CleanAIr grants you a limited, non-exclusive license to use the protocol for personal cessation efforts. Commercial exploitation of recovery plans is strictly prohibited.'
          },
          {
            title: '2. Code of Conduct',
            body: 'Harassment, hate speech, or compromising the resilience of other operatives will result in immediate protocol termination and network blacklisting.'
          },
          {
            title: '3. Medical Disclaimer',
            body: 'CleanAIr is a support tool, not a medical device. Always consult with a verified biological medical professional before starting any intensive withdrawal protocol.'
          },
          {
            title: '4. Liability',
            body: 'We are not responsible for any technical relapses or physical discomfort resulting from the implementation of generated recovery plans.'
          }
        ]
      };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-charcoal/95 backdrop-blur-2xl flex items-end sm:items-center justify-center"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-white w-full max-w-[375px] h-[90vh] sm:h-[812px] rounded-t-[40px] sm:rounded-[60px] flex flex-col overflow-hidden relative"
      >
        <header className="px-8 pt-12 pb-8 flex flex-col items-center text-center border-b border-gray-50">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-charcoal mb-4 shadow-inner">
            {content.icon}
          </div>
          <h2 className="text-2xl font-black text-charcoal tracking-tight uppercase leading-none">{content.title}</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-2">{content.subtitle}</p>
          
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-charcoal transition-all"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-10 no-scrollbar">
          <div className="flex flex-col gap-10">
            {content.sections.map((section, i) => (
              <div key={i} className="flex flex-col gap-3">
                <h3 className="text-xs font-black text-charcoal uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-3 bg-sage rounded-full" />
                  {section.title}
                </h3>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-12 p-8 bg-gray-50 rounded-[32px] text-center border border-gray-100 mb-20">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 leading-relaxed">
              Last Protocol Revision:<br/>OCTOBER 24, 2026
            </p>
          </div>
        </div>

        <div className="p-8 bg-white border-t border-gray-50">
          <button 
            onClick={onClose}
            className="w-full py-5 bg-charcoal text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-sage transition-all active:scale-95"
          >
            Acknowledge Protocol
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
