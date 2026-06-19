import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMeta, runSearch, type ParamsMap, type ParamValue } from './api/client';
import { ApiKeyBanner } from './components/ApiKeyBanner';
import { AboutWebIQ } from './components/AboutWebIQ';
import { EndpointSidebar } from './components/EndpointSidebar';
import { ErrorBanner } from './components/ErrorBanner';
import { Header } from './components/Header';
import { compactParams, defaultParams, ParameterForm } from './components/ParameterForm';
import { Footer } from './components/Footer';
import { OutputTabs } from './components/OutputTabs';
import { RunBar } from './components/RunBar';
import type { EndpointMeta, MetaResponse, SearchFailure, SearchResponse } from './types/meta';

interface LastRequest {
  endpointId: string;
  input: string;
  params: ParamsMap;
}

function endpointInputDefault(endpoint?: EndpointMeta): string {
  return endpoint?.inputPlaceholder ?? '';
}

function networkFailure(endpointId: string, message: string): SearchFailure {
  return {
    ok: false,
    endpointId,
    error: {
      class: 'NetworkError',
      message,
    },
  };
}

export default function App() {
  const [meta, setMeta] = useState<MetaResponse>();
  const [metaError, setMetaError] = useState<string>();
  const [view, setView] = useState<'home' | 'endpoint'>('home');
  const [selectedId, setSelectedId] = useState<string>();
  const [input, setInput] = useState('');
  const [params, setParams] = useState<ParamsMap>({});
  const [response, setResponse] = useState<SearchResponse>();
  const [lastRequest, setLastRequest] = useState<LastRequest>();
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController>();

  const selectedEndpoint = useMemo(
    () => meta?.endpoints.find((endpoint) => endpoint.id === selectedId),
    [meta?.endpoints, selectedId],
  );

  const applyEndpoint = useCallback((endpoint: EndpointMeta) => {
    abortRef.current?.abort();
    setView('endpoint');
    setSelectedId(endpoint.id);
    setInput(endpointInputDefault(endpoint));
    setParams(defaultParams(endpoint.params));
    setResponse(undefined);
    setLastRequest(undefined);
    setLoading(false);
  }, []);

  const selectHome = useCallback(() => {
    abortRef.current?.abort();
    setView('home');
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    getMeta()
      .then((nextMeta) => {
        if (!mounted) {
          return;
        }

        setMeta(nextMeta);
      })
      .catch((error: unknown) => {
        if (mounted) {
          setMetaError(error instanceof Error ? error.message : 'Unable to load API metadata.');
        }
      });

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  const updateParam = (name: string, value: ParamValue | '') => {
    setParams((current) => {
      const next = { ...current };

      if (value === '' || (Array.isArray(value) && value.length === 0)) {
        delete next[name];
      } else {
        next[name] = value;
      }

      return next;
    });
  };

  const handleRun = async () => {
    if (!selectedEndpoint || input.trim() === '') {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestParams = compactParams(params);
    const request: LastRequest = {
      endpointId: selectedEndpoint.id,
      input: input.trim(),
      params: requestParams,
    };

    setLoading(true);
    setResponse(undefined);
    setLastRequest(request);

    try {
      const nextResponse = await runSearch(selectedEndpoint.id, request.input, request.params, controller.signal);
      setResponse(nextResponse);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setResponse(
        networkFailure(
          selectedEndpoint.id,
          error instanceof Error ? error.message : 'Request failed before the API returned a response.',
        ),
      );
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = undefined;
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const telemetry = response?.ok ? response.telemetry : response?.telemetry;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        <div>
          {meta ? (
            <EndpointSidebar
              endpoints={meta.endpoints}
              homeSelected={view === 'home'}
              onSelect={applyEndpoint}
              onSelectHome={selectHome}
              selectedId={selectedId}
            />
          ) : (
            <div className="card p-4 text-sm text-ink-500 dark:text-ink-400">Loading endpoints…</div>
          )}
        </div>
        <div className="space-y-5">
          {metaError ? (
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {metaError}
            </div>
          ) : null}
          {view === 'home' ? (
            <AboutWebIQ />
          ) : selectedEndpoint ? (
            <>
              {meta && !meta.keyConfigured ? <ApiKeyBanner /> : null}
              <section className="card space-y-6 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-white">{selectedEndpoint.label}</h2>
                    <span className="badge bg-ink-100 text-ink-700 ring-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700">{selectedEndpoint.kind}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-600 dark:text-ink-400">{selectedEndpoint.description}</p>
                </div>
                <label className="block" htmlFor="primary-input">
                  <span className="text-sm font-semibold text-ink-800 dark:text-ink-200">{selectedEndpoint.inputLabel}</span>
                  <input
                    className="input mt-2 py-3 text-base"
                    id="primary-input"
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={selectedEndpoint.inputPlaceholder}
                    type={selectedEndpoint.kind === 'url' ? 'url' : 'search'}
                    value={input}
                  />
                </label>
                <ParameterForm
                  onChange={updateParam}
                  onReset={() => setParams(defaultParams(selectedEndpoint.params))}
                  params={selectedEndpoint.params}
                  values={params}
                />
                <RunBar disabled={input.trim() === ''} loading={loading} onCancel={cancel} onRun={handleRun} telemetry={telemetry} />
                <p className="text-xs leading-5 text-ink-500 dark:text-ink-400">
                  Heads up: requests you run here are logged anonymously — the endpoint, timing,
                  and outcome (never your query text) — for usage statistics. No cookies are used;
                  see our{' '}
                  <a className="font-semibold text-brand-600 hover:underline dark:text-brand-300" href="/privacy">
                    privacy notice
                  </a>{' '}
                  to opt out.
                </p>
              </section>
              {response && !response.ok ? <ErrorBanner failure={response} /> : null}
              {loading ? (
                <div className="card space-y-3 p-5">
                  <div className="h-4 w-1/3 animate-pulse bg-ink-200 dark:bg-ink-700" />
                  <div className="h-20 animate-pulse bg-ink-100 dark:bg-ink-800" />
                  <div className="h-20 animate-pulse bg-ink-100 dark:bg-ink-800" />
                </div>
              ) : null}
              <OutputTabs
                endpoint={selectedEndpoint}
                input={lastRequest?.input ?? input}
                params={lastRequest?.params ?? compactParams(params)}
                response={response}
              />
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
