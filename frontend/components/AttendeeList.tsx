'use client';

import { X, Mail, Users } from 'lucide-react';
import type { Attendee } from '@/lib/types';
import { AttendeeInput } from './AttendeeInput';

interface AttendeeListProps {
  attendees: Attendee[];
  onAdd: (email: string, name?: string) => void;
  onRemove: (email: string) => void;
  disabled?: boolean;
}

export function AttendeeList({ attendees, onAdd, onRemove, disabled }: AttendeeListProps) {
  return (
    <div className="glass-card h-full flex flex-col">
      {/* 標題 */}
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Users className="w-5 h-5 text-neon-cyan" />
        <h2 className="text-base sm:text-lg font-semibold text-white">與會者</h2>
        <span className="ml-auto text-sm text-neon-cyan font-mono">
          ⟨{attendees.length}⟩
        </span>
      </div>
      
      {/* 新增與會者 */}
      <div className="mb-4">
        <AttendeeInput onAdd={onAdd} disabled={disabled} />
      </div>
      
      {/* 與會者列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {attendees.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-zinc-500">
            <Mail className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">尚未新增與會者</p>
          </div>
        ) : (
          attendees.map((attendee) => (
            <div
              key={attendee.email}
              className="flex items-center gap-3 p-3 rounded-xl
                         group transition-all duration-200 animate-slide-up
                         bg-white/5 border border-white/5
                         hover:border-neon-cyan/30 hover:bg-neon-cyan/5"
            >
              <Mail className="w-4 h-4 text-neon-cyan/70 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {attendee.name && (
                  <p className="text-sm font-medium text-white truncate">
                    {attendee.name}
                  </p>
                )}
                <p className={`text-sm truncate ${attendee.name ? 'text-zinc-400' : 'text-zinc-300'}`}>
                  {attendee.email}
                </p>
              </div>
              <button
                onClick={() => onRemove(attendee.email)}
                disabled={disabled}
                className="p-1.5 text-zinc-500 hover:text-neon-pink hover:bg-neon-pink/10 
                           rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100
                           disabled:opacity-0"
                aria-label={`移除 ${attendee.email}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
