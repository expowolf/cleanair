import React from 'react';
import { motion } from 'motion/react';

export const BirdLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 55C20 55 35 35 55 45C75 55 90 40 90 40C90 40 75 70 55 65C35 60 20 75 20 75V55Z" />
    <path d="M55 45C55 45 50 30 40 35C30 40 35 50 35 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="45" cy="42" r="2" />
  </svg>
);

export const LungsIcon = ({ className = "w-32 h-32" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lungsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7DB87A" />
        <stop offset="100%" stopColor="#5A9A57" />
      </linearGradient>
    </defs>
    {/* Left Lobe */}
    <path 
      d="M45 30C35 25 20 25 15 45C10 65 20 85 40 85C45 85 48 80 48 70V40C48 35 47 32 45 30Z" 
      fill="url(#lungsGradient)" 
    />
    {/* Right Lobe */}
    <path 
      d="M55 30C65 25 80 25 85 45C90 65 80 85 60 85C55 85 52 80 52 70V40C52 35 53 32 55 30Z" 
      fill="url(#lungsGradient)" 
    />
    {/* Trachea */}
    <path 
      d="M50 15V35M50 35L45 40M50 35L55 40" 
      stroke="#7DB87A" 
      strokeWidth="4" 
      strokeLinecap="round" 
    />
  </svg>
);
