import { useState, useEffect, useRef } from 'react';
import { useStudio } from '../../store/useStudioStore';
import { useModalA11y } from '../layout/useModalA11y';
import {
  openSession,
  tokenSummary,
  BG_SCOPES,
  type BreakGlassSession,
  type IssueResult,
  type CheckResult,
} from '../../engine/breakGlass';
import type { FounderToken } from '../../engine/ed25519Verifier';
import { useT } from '../../i18n/useT';

export function BreakGlassModal() {
  const tr = useT();
  const breakGlassModalOpen = useStudio((s) => s.breakGlassModalOpen);
  const setBreakGlassModalOpen = useStudio((s) => s.setBreakGlassModalOpen);

  const [session, setSession] = useState<BreakGlassSession | null>(null);
  const [scope, setScope] = useState<string>(BG_SCOPES[0]);
  const [targetResource, setTargetResource] = useState('dept_opportunity_acquisition:task:a1b2c3d4');
  const [confirmTarget, setConfirmTarget] = useState('dept_opportunity_acquisition:task:a1b2c3d4');
  const [amount, setAmount] = useState(500);
  const [ttlSeconds, setTtlSeconds] = useState(900); // 15 mins max
  const [issuedToken, setIssuedToken] = useState<FounderToken | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<CheckResult | null>(null);
  const [replayAttempted, setReplayAttempted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  useModalA11y({
    isOpen: breakGlassModalOpen,
    onClose: () => setBreakGlassModalOpen(false),
    dialogRef,
  });

  // Initialize new session whenever modal opens
  useEffect(() => {
    if (breakGlassModalOpen) {
      let alive = true;
      openSession().then((sess) => {
        if (alive) {
          setSession(sess);
          setIssuedToken(null);
          setIssueError(null);
          setVerifyResult(null);
          setReplayAttempted(false);
        }
      });
      return () => {
        alive = false;
      };
    }
  }, [breakGlassModalOpen]);

  if (!breakGlassModalOpen) return null;

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIssueError(null);
    setVerifyResult(null);
    setReplayAttempted(false);

    const res: IssueResult = await session.issue({
      scope,
      target_resource: targetResource,
      confirm_target: confirmTarget,
      max_amount_usd: amount,
      ttl_seconds: ttlSeconds,
    });

    if (!res.ok) {
      setIssueError(`[${res.code}] ${res.reason}`);
      setIssuedToken(null);
    } else {
      setIssuedToken(res.token);
    }
  };

  const handleVerify = async () => {
    if (!session || !issuedToken) return;
    const res = await session.verify(issuedToken);
    setVerifyResult(res);
  };

  const handleReplay = async () => {
    if (!session || !issuedToken) return;
    // Second verification with the same token/nonce
    setReplayAttempted(true);
    const res = await session.verify(issuedToken);
    setVerifyResult(res);
  };

  const summary = issuedToken ? tokenSummary(issuedToken) : null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakglass-modal-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div>
            <div className="text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
              {tr('breakglass.title')}
            </div>
            <h2 id="breakglass-modal-title" className="text-sm font-bold text-slate-100">
              Founder Ed25519 Cryptographic Authorization (IAM-001, IAM-002)
            </h2>
          </div>
          <button
            onClick={() => setBreakGlassModalOpen(false)}
            aria-label={tr('inspector.close')}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Security Rules Notice */}
          <div className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-[11px] text-amber-200/90 space-y-1">
            <div className="font-semibold text-amber-300">Constitutional Security Rules (§4.5):</div>
            <div>• Maximum lifetime (TTL) cannot exceed 900 seconds (15 minutes).</div>
            <div>• Target confirmation is strictly enforced to prevent ambiguous delegation.</div>
            <div>• Nonces are strictly single-use to prevent replay attacks.</div>
            <div>• Private keys are ephemeral session-only and never exposed or stored.</div>
          </div>

          {session && (
            <div className="rounded border border-slate-800 bg-slate-950/60 p-2.5 font-mono text-[11px] text-slate-400 truncate">
              Session Public Key:{' '}
              <span className="text-sky-400">{session.publicKey}</span>
            </div>
          )}

          {issueError && (
            <div role="alert" className="rounded border border-rose-500/50 bg-rose-950/60 p-2 text-rose-300">
              {issueError}
            </div>
          )}

          {/* Issue Form */}
          <form onSubmit={handleIssue} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 font-medium">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                >
                  {BG_SCOPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-medium">{tr('breakglass.amount')}</label>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 font-medium">{tr('breakglass.target')}</label>
                <input
                  value={targetResource}
                  onChange={(e) => setTargetResource(e.target.value)}
                  placeholder="dept:task:id"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium">{tr('breakglass.confirm')}</label>
                <input
                  value={confirmTarget}
                  onChange={(e) => setConfirmTarget(e.target.value)}
                  placeholder="re-type target exactly"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-medium">
                {tr('breakglass.ttl')} (Current: {ttlSeconds}s / {(ttlSeconds / 60).toFixed(0)}m)
              </label>
              <input
                type="range"
                min="60"
                max="900"
                step="30"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(parseInt(e.target.value, 10))}
                className="mt-1 w-full"
              />
            </div>

            <button
              type="submit"
              className="rounded bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            >
              {tr('breakglass.issue')}
            </button>
          </form>

          {/* Token Summary & Replay Demonstration */}
          {summary && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  {tr('breakglass.token')}
                </h3>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-emerald-400 font-mono">
                  Token Minted
                </span>
              </div>

              {/* Safe Token Summary (no private key, no signature) */}
              <pre className="overflow-x-auto rounded border border-slate-800 bg-slate-900 p-2.5 font-mono text-[11px] text-slate-300">
                {JSON.stringify(summary, null, 2)}
              </pre>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleVerify}
                  className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500"
                >
                  {tr('breakglass.verify')} (First Use)
                </button>
                <button
                  onClick={handleReplay}
                  className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
                >
                  {tr('breakglass.replay')}
                </button>
              </div>

              {/* Verification Output */}
              {verifyResult && (
                <div
                  className={`rounded p-2.5 text-xs border ${
                    verifyResult.ok
                      ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                      : 'border-rose-800 bg-rose-950/40 text-rose-300'
                  }`}
                >
                  <div className="font-semibold">
                    {verifyResult.ok ? 'TOKEN VALIDATED (First Use Accepted)' : 'VERIFICATION REJECTED'}
                  </div>
                  {!verifyResult.ok && (
                    <div className="mt-1 font-mono text-[11px]">
                      Code: <strong className="text-rose-400">{verifyResult.code}</strong> — {verifyResult.reason}
                      {replayAttempted && (
                        <div className="mt-1 text-amber-300">
                          Replay attack prevented: Single-use Nonce was already consumed and recorded in registry.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 bg-slate-950 px-5 py-3">
          <button
            onClick={() => setBreakGlassModalOpen(false)}
            className="rounded bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            {tr('wizard.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
