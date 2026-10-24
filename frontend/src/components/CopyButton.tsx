import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

/**
 * Nút copy text vào clipboard.
 * Dùng navigator.clipboard.writeText, fallback qua textarea + execCommand
 * cho trình duyệt / ngữ cảnh chặn Clipboard API. Hiện "Đã copy" 2 giây.
 */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const doCopy = async () => {
    const value = text ?? '';
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback: textarea tạm + execCommand('copy').
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={doCopy} title={label}>
      <Icon name="copy" size={14} />
      {copied ? 'Đã copy' : label}
    </button>
  );
}
