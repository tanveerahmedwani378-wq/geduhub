import React, { useEffect, useRef } from 'react';
import { useChat } from '@/contexts/ChatContext';

const PUBLISHER_ID = 'ca-pub-8975168290920922';

interface AdSlotProps {
  /** AdSense ad unit slot ID (from AdSense → Ads → By ad unit). */
  slot: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Google AdSense display ad. Hidden for premium users.
 * Create an ad unit in AdSense, then pass its slot ID as `slot`.
 */
export const AdSlot: React.FC<AdSlotProps> = ({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  style,
}) => {
  const { userProfile } = useChat();
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (userProfile.isPremium) return;
    if (pushed.current) return;
    try {
      // @ts-ignore - adsbygoogle is injected by the AdSense script in index.html
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {
      console.warn('AdSense push failed:', e);
    }
  }, [userProfile.isPremium, slot]);

  if (userProfile.isPremium) return null;

  return (
    <div className={`w-full flex justify-center my-2 ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', ...style }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};
