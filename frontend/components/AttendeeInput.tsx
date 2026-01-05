'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

interface AttendeeInputProps {
  onAdd: (email: string, name?: string) => void;
  disabled?: boolean;
}

export function AttendeeInput({ onAdd, disabled }: AttendeeInputProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('請輸入 Email');
      return;
    }
    
    if (!validateEmail(email.trim())) {
      setError('請輸入有效的 Email 格式');
      return;
    }
    
    onAdd(email.trim(), name.trim() || undefined);
    setEmail('');
    setName('');
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="輸入 Email..."
            className="input-neon"
            disabled={disabled}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !email.trim()}
          className="btn-icon disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="新增與會者"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="姓名（選填）"
        className="input-neon"
        disabled={disabled}
      />
      
      {error && (
        <p className="text-sm text-neon-pink">{error}</p>
      )}
    </form>
  );
}
