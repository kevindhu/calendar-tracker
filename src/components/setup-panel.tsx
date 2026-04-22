type SetupPanelProps = {
  title: string;
  detail: string;
  missing?: string[];
};

export function SetupPanel({ title, detail, missing = [] }: SetupPanelProps) {
  return (
    <main className="setup-shell">
      <section className="setup-panel">
        <p className="eyebrow">Setup</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        {missing.length > 0 ? (
          <div className="missing-list" aria-label="Missing configuration">
            {missing.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
