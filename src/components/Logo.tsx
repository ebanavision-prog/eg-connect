import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export default function Logo({ className = '', size = 32, showText = false, variant = 'dark' }: LogoProps) {
  const textColor = variant === 'dark' ? 'text-[#1B2B48]' : 'text-white';
  
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div 
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Support geometric lines - subtle background */}
          <path d="M50 15L78 33V67L50 85L22 67V33L50 15Z" stroke="#1B2B48" strokeWidth="0.5" strokeOpacity="0.1" />
          <path d="M50 15V85M22 33L78 67M22 67L78 33" stroke="#1B2B48" strokeWidth="0.5" strokeOpacity="0.1" />
          
          {/* Connection lines between navy nodes - Stronger as in image */}
          <path d="M50 15L78 33" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M50 15L22 33" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M50 15L50 50" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M78 33L50 50" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M22 33L50 50" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M78 33L78 67" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M22 33L22 67" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M50 50L78 67" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M50 50L22 67" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M50 50L50 85" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M78 67L50 85" stroke="#1B2B48" strokeWidth="3.5" />
          <path d="M22 67L50 85" stroke="#1B2B48" strokeWidth="3.5" />
          
          {/* Navy Nodes as per the image icon */}
          <circle cx="50" cy="15" r="7.5" fill="#1B2B48" />
          <circle cx="78" cy="33" r="7.5" fill="#1B2B48" />
          <circle cx="22" cy="33" r="7.5" fill="#1B2B48" />
          <circle cx="50" cy="50" r="7.5" fill="#1B2B48" />
          <circle cx="78" cy="67" r="7.5" fill="#1B2B48" />
          <circle cx="22" cy="67" r="7.5" fill="#1B2B48" />
          <circle cx="50" cy="85" r="7.5" fill="#1B2B48" />
          
          {/* Teal Accent Nodes - Positioned exactly as dots in the image */}
          <circle cx="12" cy="50" r="6.5" fill="#53B9C1" />
          <circle cx="88" cy="50" r="6.5" fill="#53B9C1" />
          <circle cx="50" cy="98" r="6.5" fill="#53B9C1" />
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-start gap-1">
            <span className={`font-display font-extrabold text-[1.6em] tracking-tighter ${textColor}`} style={{ lineHeight: '0.9' }}>EG CONNECT</span>
            <span className="text-[0.4em] font-bold text-[#53B9C1] mt-1">TM</span>
          </div>
          <span className={`text-[0.45em] font-medium tracking-[0.02em] whitespace-nowrap opacity-90 mt-1 ${textColor}`}>
            networking, entrepreneurship and accountability
          </span>
        </div>
      )}
    </div>
  );
}
