import React from 'react';
import {
  ChevronsUpDown,
  ClipboardCheck,
  FileClock,
  LayoutGrid,
  Layers,
  LifeBuoy,
  ListChecks,
  Lock,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Workflow
} from 'lucide-react';

/**
 * The workspace's navigation.
 *
 * It replaced a row of links across the top, which had run out of room: eleven
 * modules on one line leaves no space for a count beside any of them, and no
 * way to say that two of them are governance and the rest are not.
 *
 * A panel gives each item a line of its own, room for a number, and a heading
 * over each group — and it collapses to a rail of icons for somebody who wants
 * the width back. Both widths are fixed rather than draggable, because a
 * navigation that every person has sized differently is one nobody can be
 * talked through over the phone.
 */

export type SidePanelItemId =
  | 'actions'
  | 'announcements'
  | 'audit'
  | 'dashboard'
  | 'lsw'
  | 'lsw-verification'
  | 'rails'
  | 'rca'
  | 'retention'
  | 'support';

export interface SidePanelItem {
  /** A number worth seeing before opening it. Absent shows nothing. */
  count?: number;
  id: SidePanelItemId;
  label: string;
  /** Shown, but not reachable. Saying so beats a menu that changes shape per person. */
  locked?: boolean;
  /** Opens without the panel, and comes back through a back button. */
  opensFullScreen?: boolean;
}

export interface SidePanelGroup {
  items: SidePanelItem[];
  title: string;
}

const ICONS: Record<SidePanelItemId, React.ComponentType<{ size?: number }>> = {
  actions: ListChecks,
  announcements: Megaphone,
  audit: FileClock,
  dashboard: LayoutGrid,
  lsw: ClipboardCheck,
  'lsw-verification': ShieldCheck,
  rails: Layers,
  rca: Workflow,
  retention: Scale,
  support: LifeBuoy
};

export function SidePanel({
  activeId,
  avatar,
  companyName,
  departmentName,
  displayName,
  groups,
  isCollapsed,
  isSettingsActive,
  onOpenAccount,
  onOpenSettings,
  onSelect,
  onToggleCollapsed,
  role
}: {
  activeId: string;
  /** Passed in rather than imported: the avatar lives in the shell. */
  avatar: React.ReactNode;
  companyName: string;
  departmentName: string;
  displayName: string;
  groups: SidePanelGroup[];
  isCollapsed: boolean;
  isSettingsActive: boolean;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
  onSelect: (id: SidePanelItemId) => void;
  onToggleCollapsed: () => void;
  role: string;
}) {
  const [search, setSearch] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const query = search.trim().toLowerCase();
  const shownGroups = groups
    .map((group) => ({
      ...group,
      items: query
        ? group.items.filter((item) => item.label.toLowerCase().includes(query))
        : group.items
    }))
    .filter((group) => group.items.length > 0);

  // ⌘K, because somebody who navigates by typing should not have to reach for
  // the panel to start.
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <nav
      aria-label="Workspace"
      className={isCollapsed ? 'side-panel is-collapsed' : 'side-panel'}
    >
      <div className="side-panel-brand">
        <img alt="" className="side-panel-mark" src="/assets/notification.png" />
        {isCollapsed ? null : (
          <div className="side-panel-brand-text">
            <span className="side-panel-brand-name">Synzapp</span>
            <span className="side-panel-brand-company">{companyName}</span>
          </div>
        )}
        <button
          aria-label={isCollapsed ? 'Expand the navigation' : 'Collapse the navigation'}
          className="side-panel-collapse"
          onClick={onToggleCollapsed}
          title={isCollapsed ? 'Expand' : 'Collapse'}
          type="button"
        >
          {isCollapsed
            ? <PanelLeftOpen aria-hidden="true" size={17} />
            : <PanelLeftClose aria-hidden="true" size={17} />}
        </button>
      </div>

      {isCollapsed ? null : (
        <div className="side-panel-search">
          <Search aria-hidden="true" size={15} />
          <input
            aria-label="Search the workspace"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            ref={searchRef}
            type="search"
            value={search}
          />
          <kbd>⌘K</kbd>
        </div>
      )}

      <div className="side-panel-scroll">
        {shownGroups.map((group) => (
          <div className="side-panel-group" key={group.title}>
            {isCollapsed ? <div className="side-panel-group-rule" /> : (
              <p className="side-panel-group-title">{group.title}</p>
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.id];
              const isActive = item.id === activeId;

              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={item.locked || undefined}
                  className={[
                    'side-panel-item',
                    isActive ? 'is-selected' : '',
                    item.locked ? 'is-locked' : ''
                  ].filter(Boolean).join(' ')}
                  key={item.id}
                  onClick={() => {
                    if (!item.locked) {
                      onSelect(item.id);
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                  type="button"
                >
                  <span className="side-panel-item-icon">
                    {item.locked ? <Lock aria-hidden="true" size={17} /> : <Icon size={17} />}
                  </span>
                  {isCollapsed ? null : (
                    <span className="side-panel-item-label">{item.label}</span>
                  )}
                  {/* Collapsed, a number has nowhere to go — a dot says there is
                      something without pretending to say how much. */}
                  {item.count && isCollapsed ? <span className="side-panel-item-dot" /> : null}
                  {item.count && !isCollapsed ? (
                    <span className={isActive ? 'side-panel-count is-selected' : 'side-panel-count'}>
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
        {!shownGroups.length ? (
          <p className="side-panel-empty">Nothing matches that.</p>
        ) : null}
      </div>

      {/* Kept out of the groups so it always sits last, above the identity. */}
      <div className="side-panel-group side-panel-group-tail">
        <button
          aria-current={isSettingsActive ? 'page' : undefined}
          className={isSettingsActive ? 'side-panel-item is-selected' : 'side-panel-item'}
          onClick={onOpenSettings}
          title={isCollapsed ? 'Settings' : undefined}
          type="button"
        >
          <span className="side-panel-item-icon">
            <Settings aria-hidden="true" size={17} />
          </span>
          {isCollapsed ? null : <span className="side-panel-item-label">Settings</span>}
        </button>
      </div>

      <button
        aria-label={`Account menu for ${displayName}`}
        className="side-panel-account"
        onClick={onOpenAccount}
        type="button"
      >
        {avatar}
        {isCollapsed ? null : (
          <>
            <span className="side-panel-account-text">
              {/* The role is the permission scope, and the department under it.
                  Both come from the directory; neither is typed by anybody. */}
              <span className="side-panel-account-role">{role}</span>
              <span className="side-panel-account-department">{departmentName}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" size={15} />
          </>
        )}
      </button>
    </nav>
  );
}
