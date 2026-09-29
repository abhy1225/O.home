'use client';
import React, { useState } from 'react';
import { useMembers } from '@/lib/members';
import { KInput } from '@/components/ui/Kit';

/** 비밀글 지정 열람자 — 관리자는 항상 열람 가능하므로 선택 목록에서 제외한다. */
export function ViewerPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const members = useMembers().filter(m => m.role !== 'admin');
  const [q, setQ] = useState('');
  const key = q.trim().toLowerCase();
  const selected = value.map(id => members.find(m => m.id === id)).filter(Boolean) as typeof members;
  const matches = key ? members.filter(m => !value.includes(m.id) &&
    (m.nickname.toLowerCase().includes(key) || m.username.toLowerCase().includes(key))) : [];
  return <div style={{ display: 'grid', gap: 7, width: '100%' }}>
    <KInput value={q} onChange={e => setQ(e.target.value)} placeholder="열람 허용 회원 닉네임·아이디 검색" />
    {matches.length > 0 && <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: 4, maxHeight: 150, overflow: 'auto' }}>
      {matches.map(m => <button type="button" key={m.id} onClick={() => { onChange([...value, m.id]); setQ(''); }}
        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}>
        <span>{m.nickname}</span><small style={{ color: 'var(--faint)' }}>{m.username}</small>
      </button>)}
    </div>}
    {selected.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {selected.map(m => <button type="button" key={m.id} className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}
        onClick={() => onChange(value.filter(id => id !== m.id))}>{m.nickname} ×</button>)}
    </div>}
    <p className="hint" style={{ margin: 0 }}>관리자·작성자는 항상 열람 가능하며, 여기서 고른 회원도 비밀글을 볼 수 있습니다.</p>
  </div>;
}
