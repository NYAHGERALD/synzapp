import { ArrowRight } from 'lucide-react';
import type { SidePanelGroup, SidePanelItemId } from './SidePanel';

/**
 * The page the workspace opens on, and the one a full-screen section comes back
 * to.
 *
 * It exists because the app used to open straight into LSW, and LSW is now one
 * of the sections that takes the whole window — landing there would mean
 * arriving with no navigation in sight. Somewhere to stand had to exist before
 * anything could return to it.
 *
 * Deliberately a set of ways in rather than a wall of numbers. A dashboard that
 * tries to summarise everything is a dashboard nobody reads twice, and every
 * figure on it is another query on the path people take most often.
 */

export function DashboardHome({
  companyName,
  displayName,
  groups,
  onOpen
}: {
  companyName: string;
  displayName: string;
  groups: SidePanelGroup[];
  onOpen: (id: SidePanelItemId) => void;
}) {
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;

  return (
    <div className="dashboard-home">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">{companyName}</span>
            <h1>Good to see you, {firstName}</h1>
            <p className="page-hero-lead">
              Everything you have access to is on the left. Pick up where you left
              off, or start somewhere new.
            </p>
          </div>
        </header>

        {groups.map((group) => {
          // Only what this person can actually open. A card that explains it is
          // locked is a card taking up room to say no.
          const reachable = group.items.filter((item) => !item.locked && item.id !== 'dashboard');

          if (!reachable.length) {
            return null;
          }

          return (
            <section className="page-section" key={group.title}>
              <div className="page-section-head">
                <h2>{group.title.charAt(0) + group.title.slice(1).toLowerCase()}</h2>
              </div>
              <div className="dashboard-home-grid">
                {reachable.map((item) => (
                  <button
                    className="dashboard-home-card"
                    key={item.id}
                    onClick={() => onOpen(item.id)}
                    type="button"
                  >
                    <span className="dashboard-home-card-title">{item.label}</span>
                    {item.count ? (
                      <span className="dashboard-home-card-count">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    ) : null}
                    <ArrowRight aria-hidden="true" className="dashboard-home-card-arrow" size={16} />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
