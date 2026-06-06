const skeletonHabits = Array.from({ length: 4 }, (_, index) => index);
const skeletonDays = Array.from({ length: 42 }, (_, index) => index);
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Calendar loading"
      className="app-shell app-shell-detail app-shell-with-nav app-shell-panel-closed loading-shell"
    >
      <div className="mobile-nav-row loading-mobile-nav-row">
        <span className="mobile-menu-button skeleton-box skeleton-circle" />
        <span className="skeleton-box skeleton-line skeleton-line-short" />
      </div>

      <aside className="habit-sidebar" aria-hidden="true">
        <div className="habit-sidebar-header">
          <span className="skeleton-box skeleton-line skeleton-line-eyebrow" />
          <span className="skeleton-box skeleton-line skeleton-line-title" />
        </div>
        <nav className="habit-list">
          {skeletonHabits.map((habit) => (
            <div className="habit-nav-item loading-habit-nav-item" key={habit}>
              <span className="habit-nav-icon skeleton-box skeleton-circle" />
              <span className="habit-nav-copy">
                <span className="skeleton-box skeleton-line" />
                <small className="skeleton-box skeleton-line skeleton-line-short" />
              </span>
              <span className="habit-streak-label skeleton-box skeleton-pill" />
            </div>
          ))}
        </nav>
      </aside>

      <section className="calendar-panel" aria-hidden="true">
        <header className="app-header">
          <div>
            <span className="skeleton-box skeleton-line skeleton-line-eyebrow" />
            <span className="skeleton-box skeleton-line skeleton-line-heading" />
          </div>
          <div className="header-pill-stack">
            <span className="streak-pill skeleton-box skeleton-pill" />
            <span className="live-pill skeleton-box skeleton-pill" />
          </div>
        </header>

        <div className="month-bar">
          <span className="icon-button skeleton-box skeleton-icon-button" />
          <div className="month-title">
            <span className="skeleton-box skeleton-line skeleton-line-title" />
            <span className="skeleton-box skeleton-line skeleton-line-short" />
          </div>
          <span className="icon-button skeleton-box skeleton-icon-button" />
        </div>

        <div className="weekday-row" aria-hidden="true">
          {weekDays.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid calendar-grid-skeleton">
          {skeletonDays.map((day) => (
            <div className="day-cell loading-day-cell" key={day}>
              <span className="skeleton-box skeleton-day-number" />
            </div>
          ))}
        </div>

        <footer className="calendar-footer">
          <span className="today-button skeleton-box skeleton-button" />
          <span className="footer-message skeleton-box skeleton-line skeleton-line-status" />
        </footer>
      </section>
    </main>
  );
}
