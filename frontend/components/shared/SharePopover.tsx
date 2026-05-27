'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import QRCode from 'qrcode';
import { ShareOptions, shareContent, copyToClipboard } from '@/lib/utils/share';
import { Copy, Check } from 'lucide-react';

interface SharePopoverProps {
  children: ReactNode;
  options: ShareOptions;
  align?: 'left' | 'center' | 'right';
  side?: 'top' | 'bottom';
}

export function SharePopover({ children, options, align = 'center', side = 'top' }: SharePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, options.url, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#00000000' // transparent background
        }
      }, function (error) {
        if (error) console.error('Error generating QR code:', error);
      });
    }
  }, [isOpen, options.url]);

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Attempt native share first
    const sharedNatively = await shareContent(options);
    
    if (!sharedNatively) {
      // Fallback to custom desktop popover
      setIsOpen((prev) => !prev);
      setCopied(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const success = await copyToClipboard(options.url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine alignment classes
  const alignClass = 
    align === 'left' ? 'left-0' : 
    align === 'right' ? 'right-0' : 
    'left-1/2 -translate-x-1/2';
    
  const sideClass = 
    side === 'top' ? 'bottom-full mb-2' : 
    'top-full mt-2';

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <div onClick={handleShareClick} className="cursor-pointer inline-flex items-center justify-center">
        {children}
      </div>

      {isOpen && (
        <div 
          className={`absolute ${sideClass} ${alignClass} z-50 p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl w-64 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 share-popover-content`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">Share this</h4>
            <p className="text-xs text-gray-400 line-clamp-1">{options.title || options.url}</p>
          </div>
          
          <div className="bg-white p-2 rounded-md mb-4">
            <canvas ref={canvasRef} className="block"></canvas>
          </div>
          
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors text-sm font-medium"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
