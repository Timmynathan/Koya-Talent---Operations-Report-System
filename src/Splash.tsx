import { useEffect, useState } from 'react';
import opsrLogo from './assets/opsr-logo.png';
import './Splash.css';

const VISIBLE_MS = 1400;
const FADE_MS = 400;

export default function Splash() {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMounted(false);
      return;
    }

    const fadeTimer = setTimeout(() => setFading(true), VISIBLE_MS);
    const unmountTimer = setTimeout(() => setMounted(false), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className={`splash${fading ? ' splash-fade' : ''}`} aria-hidden="true">
      <div className="splash-beam" />
      <img src={opsrLogo} alt="" className="splash-logo" />
    </div>
  );
}
