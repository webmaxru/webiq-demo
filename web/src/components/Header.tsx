export function Header() {
  return (
    <header className="border-b border-ink-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
            IQ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-950">Web IQ Sandbox</h1>
            <p className="text-sm text-ink-500">AI-native grounding APIs — interactive playground</p>
          </div>
        </div>
      </div>
    </header>
  );
}
