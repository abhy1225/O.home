'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useBoards } from '@/lib/boardStore';
import { useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { boardEntries, buildMenu, useMenuSettings } from '@/lib/menuStore';
import { BOARD_SEED, Post, useLocalList, fmtDate } from '@/lib/postStore';

const boardIdFromHref = (href: string): string | null => {
  if (href === '/board') return 'main';
  if (!href.startsWith('/board?')) return null;
  try { return new URL(href, 'https://ohome.local').searchParams.get('b'); }
  catch { return null; }
};

export default function MenuLandingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [menuSet, , menuLoaded] = useMenuSettings();
  const { boards, loaded: boardsLoaded } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const [posts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);

  const extras = useMemo(
    () => [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)],
    [boards, secMap, links],
  );
  const menu = useMemo(
    () => buildMenu(menuSet, extras, { loggedIn: !!user, isAdmin, id: user?.id }),
    [menuSet, extras, user, isAdmin],
  );

  if (!menuLoaded || !boardsLoaded) return <section className="page" />;

  const id = decodeURIComponent(String(params.id ?? ''));
  const href = `/menu/${encodeURIComponent(id)}`;
  const group = menu.find(m => m.href === href && m.children);

  if (!group?.children?.length) {
    return (
      <section className="page">
        <div className="page-head"><h1>MENU</h1></div>
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--faint)' }}>
          표시할 하위 메뉴가 없습니다.
        </div>
      </section>
    );
  }

  const go = (to: string) => {
    if (/^https?:\/\//.test(to)) window.open(to, '_blank');
    else router.push(to);
  };

  return (
    <section className="page">
      <div className="page-head">
        <h1>{group.label}</h1>
        <p style={{ margin: '7px 0 0', color: 'var(--sub)', fontSize: 12 }}>
          하위 메뉴를 선택하면 해당 페이지로 이동합니다.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {group.children.map(child => {
          const bid = boardIdFromHref(child.href);
          const boardPosts = bid
            ? posts.filter(p => (p.boardId ?? 'main') === bid)
              .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
            : [];

          return (
            <div className="panel" key={child.href} style={{ padding: '18px 20px' }}>
              <button
                onClick={() => go(child.href)}
                style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em', textAlign: 'left' }}
              >
                {child.label} <span style={{ color: 'var(--faint)', fontWeight: 500 }}>→</span>
              </button>

              {bid && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--line)' }}>
                  {boardPosts.length ? boardPosts.map(p => {
                    const canRead = !p.secret || isAdmin || (!!p.authorId && p.authorId === user?.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => canRead && router.push(`/board/${p.id}`)}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--line)', textAlign: 'left', color: canRead ? 'inherit' : 'var(--faint)' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {canRead ? p.title : '🔒 비밀글입니다'}
                        </span>
                        <small style={{ flexShrink: 0, color: 'var(--faint)' }}>{fmtDate(p.date)}</small>
                      </button>
                    );
                  }) : (
                    <div style={{ padding: '12px 0 2px', fontSize: 12, color: 'var(--faint)' }}>아직 게시글이 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
