import { useState } from 'react';
import { Icon } from './icons';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  hint?: string;
  autoFocus?: boolean;
}

/** Ô nhập mật khẩu có nút hiện/ẩn (mặc định ẩn). */
export function PasswordField({ label, value, onChange, autoComplete, hint, autoFocus }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="password-wrap">
        <input
          className="input password-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </span>
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
