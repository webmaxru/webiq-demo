export function ApiKeyBanner() {
  return (
    <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <strong>API key not configured.</strong> Set <code className="font-mono">WEBIQ_API_KEY</code> in your
      server <code className="font-mono">.env</code> file and restart the API server to enable live requests.
    </div>
  );
}
