"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Link2,
  Upload,
  X,
  LoaderCircle,
  RotateCcw,
  Plus,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  ACCEPT,
  LIMITS,
  formatBytes as formatFileBytes,
} from "@/lib/shared/config";
import {
  normalizeFiles,
  sanitizeName,
  validationMessage,
} from "@/lib/shared/validation";
import type {
  InitResponse,
  ReadyResponse,
  StatusResponse,
} from "@/lib/shared/types";
import { api, copyText, uploadFile } from "@/lib/client/api";
import { Countdown, EndDialog, ErrorNotice, FileIcon, FileName } from "./ui";
import { useLanguage } from "./language";
type Progress = {
  bytes: number;
  state: "waiting" | "uploading" | "done" | "failed";
};
type Saved = { init: InitResponse; completeKey: string };
const SESSION = "quickdrop:sender";
export function Send() {
  const { t, language } = useLanguage();
  const formatBytes = (bytes: number) =>
    formatFileBytes(bytes, language === "en" ? "en-US" : "id-ID");
  const [files, setFiles] = useState<File[]>([]),
    [init, setInit] = useState<InitResponse | null>(null),
    [ready, setReady] = useState<ReadyResponse | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dragging, setDragging] = useState(false),
    [feedback, setFeedback] = useState(""),
    [manual, setManual] = useState("");
  const [ended, setEnded] = useState<"revoked" | "expired" | null>(null),
    [confirm, setConfirm] = useState(false),
    [restoring, setRestoring] = useState(false),
    [revoking, setRevoking] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null);
  const initKey = useRef(""),
    completeKey = useRef("");
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const manualInput = useRef<HTMLInputElement>(null);
  const focusResult = useRef(false);
  const endAction = useRef<HTMLButtonElement>(null);
  const focusEndAction = useRef(false);
  useEffect(() => {
    if (
      !revoking &&
      focusEndAction.current &&
      endAction.current &&
      !endAction.current.closest("[hidden]")
    ) {
      endAction.current.focus({ preventScroll: true });
      focusEndAction.current = false;
    }
  }, [revoking]);
  const picker = useRef<HTMLButtonElement>(null);
  const focusPicker = useRef(false);
  useEffect(() => {
    if (
      focusPicker.current &&
      picker.current &&
      !picker.current.closest("[hidden]")
    ) {
      picker.current.focus();
      focusPicker.current = false;
    }
  }, [ended]);
  useEffect(() => {
    if (
      focusResult.current &&
      resultHeading.current &&
      !resultHeading.current.closest("[hidden]")
    ) {
      resultHeading.current.focus();
      focusResult.current = false;
    }
  }, [ready, ended]);
  useEffect(() => {
    if (
      manual &&
      manualInput.current &&
      !manualInput.current.closest("[hidden]")
    )
      manualInput.current.focus();
  }, [manual]);
  const shareLink =
    ready && typeof window !== "undefined"
      ? `${window.location.origin}/receive#token=${ready.shareToken}`
      : "";
  function save(next: InitResponse) {
    try {
      sessionStorage.setItem(
        SESSION,
        JSON.stringify({ init: next, completeKey: completeKey.current }),
      );
    } catch {
      /* Memory remains functional with storage disabled. */
    }
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION);
    } catch {}
  }
  useEffect(() => {
    let saved: Saved | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION) ?? "null");
    } catch {}
    if (!saved?.init?.transferId || !saved.init.ownerToken) return;
    let alive = true;
    const stored = saved;
    Promise.resolve().then(() => {
      if (alive) setRestoring(true);
    });
    api<StatusResponse>(`/api/transfers/${stored.init.transferId}/status`, {
      token: stored.init.ownerToken,
    })
      .then((status) => {
        if (!alive) return;
        if (status.status === "ready" && status.ready) {
          setInit(stored.init);
          setReady(status.ready);
          completeKey.current = stored.completeKey;
        } else if (status.status === "uploading") {
          setInit(stored.init);
          completeKey.current = stored.completeKey;
          setProgress(
            status.files.map((f) => ({
              bytes: f.uploaded ? f.size : 0,
              state: f.uploaded ? "done" : "waiting",
            })),
          );
          setError(
            "Upload belum selesai. Pilih kembali batch file asli untuk melanjutkan.",
          );
        } else clearSession();
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setRestoring(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  function choose(next: File[]) {
    if (busy || revoking || ready) return;
    const batch = init ? next : [...files, ...next];
    try {
      normalizeFiles(
        batch.map((f) => ({ name: f.name, size: f.size, mime: f.type })),
      );
      if (init) {
        const unused = [...batch];
        const reordered = init.targets.map((target) => {
          const index = unused.findIndex(
            (f) =>
              sanitizeName(f.name) === target.name && f.size === target.size,
          );
          if (index < 0) throw new Error("ORIGINALS");
          return unused.splice(index, 1)[0];
        });
        if (unused.length) throw new Error("ORIGINALS");
        setFiles(reordered);
      } else {
        setFiles(batch);
        initKey.current = "";
      }
      setError("");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "ORIGINALS"
          ? "Pilih semua file asli dengan nama dan ukuran yang sama."
          : validationMessage(e),
      );
    }
    if (input.current) input.current.value = "";
  }
  const rows = init
    ? init.targets
    : files.map((f, i) => ({
        id: String(i),
        name: f.name,
        size: f.size,
        mime: f.type,
      }));
  const total = rows.reduce((n, f) => n + f.size, 0);
  const uploaded = progress.reduce((n, p) => n + p.bytes, 0);
  async function send() {
    if (busy || revoking || !files.length) return;
    setBusy(true);
    setError("");
    setFeedback("");
    const controller = new AbortController();
    abort.current = controller;
    let current = init;
    try {
      if (!initKey.current) initKey.current = crypto.randomUUID();
      if (!completeKey.current) completeKey.current = crypto.randomUUID();
      if (!current) {
        current = await api<InitResponse>("/api/transfers", {
          method: "POST",
          key: initKey.current,
          data: {
            files: files.map((f) => ({
              name: f.name,
              size: f.size,
              mime: f.type,
            })),
          },
        });
        setInit(current);
        save(current);
      }
      if (controller.signal.aborted) {
        await api(`/api/transfers/${current.transferId}`, {
          method: "DELETE",
          token: current.ownerToken,
        });
        clearSession();
        return;
      }
      const status = await api<StatusResponse>(
        `/api/transfers/${current.transferId}/status`,
        { token: current.ownerToken },
      );
      if (status.status === "ready" && status.ready) {
        focusResult.current = true;
        setReady(status.ready);
        return;
      }
      if (status.status !== "uploading")
        throw new Error("Transfer sudah berakhir. Mulai transfer baru.");
      const currentProgress = current.targets.map(
        (t) =>
          ({
            bytes: status.files.find((f) => f.id === t.id)?.uploaded
              ? t.size
              : 0,
            state: status.files.find((f) => f.id === t.id)?.uploaded
              ? "done"
              : "waiting",
          }) as Progress,
      );
      setProgress([...currentProgress]);
      function update(i: number, bytes: number, state: Progress["state"]) {
        currentProgress[i] = { bytes, state };
        setProgress([...currentProgress]);
      }
      let cursor = 0,
        failures = 0;
      const targets = current.targets;
      async function worker() {
        while (cursor < targets.length && !controller.signal.aborted) {
          const i = cursor++;
          if (currentProgress[i].state === "done") continue;
          update(i, 0, "uploading");
          try {
            await uploadFile(
              files[i],
              targets[i],
              (bytes) => update(i, bytes, "uploading"),
              controller.signal,
            );
            update(i, targets[i].size, "done");
          } catch {
            update(i, 0, "failed");
            failures++;
          }
        }
      }
      await Promise.all([worker(), worker()]);
      if (controller.signal.aborted) return;
      if (failures)
        throw new Error(
          "Ada file yang gagal diunggah. Coba lagi; file yang selesai akan dipertahankan.",
        );
      setFeedback("Memeriksa seluruh file…");
      const final = await api<ReadyResponse>(
        `/api/transfers/${current.transferId}/complete`,
        {
          method: "POST",
          token: current.ownerToken,
          key: completeKey.current,
          data: {},
        },
      );
      focusResult.current = true;
      setReady(final);
      setFeedback("File siap dibagikan.");
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Upload gagal. Coba lagi.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  async function endTransfer() {
    if (revoking) return;
    setConfirm(false);
    abort.current?.abort();
    if (init) {
      setRevoking(true);
      setFeedback("Mengakhiri transfer… Tunggu sebentar.");
      try {
        await api(`/api/transfers/${init.transferId}`, {
          method: "DELETE",
          token: init.ownerToken,
        });
        clearSession();
        focusResult.current = true;
        setEnded("revoked");
        setError("");
        setFeedback("");
      } catch (e) {
        focusEndAction.current = true;
        setError((e as Error).message);
        setFeedback("");
      } finally {
        setRevoking(false);
      }
    } else {
      setFiles([]);
    }
  }
  async function copy(value: string, label: string) {
    if (await copyText(value)) {
      setFeedback(`${label} disalin.`);
      setManual("");
    } else {
      setManual(value);
      setFeedback("Pilih dan salin teks di bawah ini.");
    }
  }
  function reset() {
    focusPicker.current = true;
    clearSession();
    setFiles([]);
    setInit(null);
    setReady(null);
    setProgress([]);
    setError("");
    setFeedback("");
    setManual("");
    setEnded(null);
    initKey.current = "";
    completeKey.current = "";
  }
  if (restoring)
    return (
      <div className="loading-state" role="status">
        <LoaderCircle className="spin" size={25} />
        <p>{t("Memulihkan transfer…")}</p>
      </div>
    );
  if (ended)
    return (
      <div className="ended-state">
        <span className="success-mark">
          <Check size={28} />
        </span>
        <h2 ref={resultHeading} tabIndex={-1}>
          {ended === "expired"
            ? t("Transfer sudah berakhir.")
            : t("Transfer diakhiri.")}
        </h2>
        <p>
          {t(
            "Kode dan tautan baru tidak dapat digunakan. Unduhan yang sudah dimulai mungkin masih berjalan.",
          )}{" "}
        </p>
        <p className="sr-only" role="status">
          {ended === "expired"
            ? t("Transfer sudah berakhir.")
            : t("Transfer diakhiri.")}
        </p>
        <button className="primary" onClick={reset}>
          {t("Kirim file lain")} <ArrowUpRight size={19} />
        </button>
      </div>
    );
  return (
    <>
      {ready ? (
        <div className="ready-state">
          <div className="state-heading">
            <span className="eyebrow">{t("SIAP DIBAGIKAN")}</span>
            <Countdown
              expiresAt={ready.expiresAt}
              serverTime={ready.serverTime}
              onEnd={() => {
                if (document.activeElement?.closest("#send-panel"))
                  focusResult.current = true;
                setEnded("expired");
                clearSession();
              }}
            />
          </div>
          <h2 ref={resultHeading} tabIndex={-1}>
            {t("File siap dibagikan.")}{" "}
          </h2>
          <p className="muted">
            {t(
              "Kamu boleh menutup halaman ini. Bagikan kode ke perangkat penerima.",
            )}{" "}
          </p>
          <div className="code-card">
            <span>{t("KODE TRANSFER")}</span>
            <strong>
              {ready.code.slice(0, 4)} {ready.code.slice(4)}
            </strong>
            <button
              aria-label={t("Salin kode")}
              className="icon-button"
              onClick={() => copy(ready.code, "Kode")}
            >
              <Copy size={20} />
            </button>
          </div>
          <div className="share-block">
            <div className="qr">
              <QRCodeSVG
                value={shareLink || "QuickDrop"}
                size={104}
                marginSize={0}
                aria-label={t(
                  "QR untuk membuka transfer ini. Gunakan Salin tautan untuk membagikannya.",
                )}
              />
            </div>
            <div>
              <h3>
                <QrCode size={17} /> {t("Atau pindai QR")}{" "}
              </h3>
              <p>{t("Buka langsung di perangkat lain.")}</p>
              <button
                className="text-button"
                onClick={() => copy(shareLink, "Tautan")}
              >
                <Link2 size={16} /> {t("Salin tautan")}{" "}
              </button>
            </div>
          </div>
          <div className="ready-files">
            {rows.map((row) => (
              <div className="file-row" key={row.id}>
                <FileIcon name={row.name} />
                <div className="file-meta">
                  <FileName name={row.name} />
                  <span>
                    {formatBytes(row.size)} ·{" "}
                    {row.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
                <Check size={17} className="check" />
              </div>
            ))}
          </div>
          <button
            ref={endAction}
            className="text-button danger end-button"
            disabled={revoking}
            onClick={() => setConfirm(true)}
          >
            {revoking ? t("Mengakhiri transfer…") : t("Akhiri transfer")}
          </button>
        </div>
      ) : (
        <>
          <div className="card-heading">
            <div>
              <span className="eyebrow">{t("DARI PERANGKAT INI")}</span>
              <h2>{t("Kirim file.")}</h2>
            </div>
            <span className="mode-symbol" aria-hidden="true">
              <ArrowUpRight size={21} />
            </span>
          </div>
          <input
            ref={input}
            type="file"
            tabIndex={-1}
            multiple
            accept={ACCEPT}
            className="sr-only"
            aria-label={t("Pilih file untuk dikirim")}
            onChange={(e) => choose(Array.from(e.target.files ?? []))}
            disabled={busy || revoking}
          />
          <button
            ref={picker}
            className={`dropzone ${dragging ? "dragging" : ""} ${rows.length ? "compact" : ""}`}
            aria-describedby={error ? "send-limits send-error" : "send-limits"}
            disabled={busy || revoking}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy && !revoking) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="upload-icon">
              {rows.length ? (
                <Plus size={25} />
              ) : (
                <Upload size={28} strokeWidth={1.7} />
              )}
            </span>
            <strong>
              {init
                ? t("Pilih ulang batch asli")
                : rows.length
                  ? t("Tambahkan file")
                  : t("Pilih file untuk dibagikan")}
            </strong>
            <span>
              {init
                ? t("Batch tetap. Pilih semua file asli jika perlu.")
                : rows.length
                  ? t("atau tarik file ke sini")
                  : t("atau tarik dan letakkan di sini")}
            </span>
            {!rows.length && (
              <span className="file-types">
                {t("Foto, dokumen, video & ZIP")}
              </span>
            )}
          </button>
          <ErrorNotice message={error} id="send-error" />
          {!!rows.length && (
            <div className="file-list">
              {rows.map((row, i) => (
                <div className="file-row" key={row.id}>
                  <FileIcon name={row.name} />
                  <div className="file-meta">
                    <FileName name={row.name} />
                    <span>
                      {formatBytes(row.size)}
                      {` · ${row.name.split(".").pop()?.toUpperCase()}`}
                      {init && progress[i]
                        ? ` · ${{ waiting: t("Menunggu"), uploading: t("Mengunggah"), done: t("Selesai"), failed: t("Gagal") }[progress[i].state]}`
                        : ""}
                    </span>
                    {init && (
                      <progress
                        max={row.size}
                        value={progress[i]?.bytes ?? 0}
                        aria-label={t(`Progres ${row.name}`)}
                      />
                    )}
                  </div>
                  {!init ? (
                    <button
                      className="icon-button"
                      aria-label={t(`Hapus ${row.name}`)}
                      onClick={() => {
                        setFiles(files.filter((_, n) => n !== i));
                        initKey.current = "";
                      }}
                    >
                      <X size={18} />
                    </button>
                  ) : progress[i]?.state === "done" ? (
                    <Check size={18} className="check" />
                  ) : progress[i]?.state === "uploading" ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div className="upload-summary" id="send-limits">
            <span>
              {rows.length
                ? t(`${rows.length} file · ${formatBytes(total)}`)
                : t("Maks. 5 file · 25 MB/file")}
            </span>
            <span>
              {busy && total
                ? `${Math.floor((uploaded / total) * 100)}%`
                : t(`Maks. total ${LIMITS.maxTotalBytes / 1_000_000} MB`)}
            </span>
          </div>
          {busy && (
            <div className="total-progress">
              <progress
                value={uploaded}
                max={total || 1}
                aria-label={t("Progres total")}
              />
              <span>
                {t(`${formatBytes(uploaded)} dari ${formatBytes(total)}`)}
              </span>
            </div>
          )}
          <button
            className="primary"
            disabled={busy || revoking || !files.length}
            onClick={send}
          >
            {busy ? (
              <>
                <LoaderCircle size={19} className="spin" />{" "}
                {uploaded === total && total
                  ? t("Memeriksa file…")
                  : t("Mengunggah file…")}
              </>
            ) : init ? (
              <>
                <RotateCcw size={18} /> {t("Coba lagi")}{" "}
              </>
            ) : (
              <>
                {t("Buat kode transfer")} <ArrowUpRight size={20} />
              </>
            )}
          </button>
          {init && (
            <button
              ref={endAction}
              className="text-button danger end-button"
              disabled={revoking}
              onClick={() => setConfirm(true)}
            >
              {revoking ? t("Mengakhiri transfer…") : t("Batalkan transfer")}
            </button>
          )}
          <p className="card-footnote">
            {t("Kode berlaku 30 menit setelah semua file siap.")}{" "}
          </p>
        </>
      )}
      {ready && <ErrorNotice message={error} id="send-error" />}
      <p className="feedback" role="status">
        {t(feedback)}
      </p>
      {manual && (
        <input
          ref={manualInput}
          className="manual-copy"
          aria-label={t("Teks untuk disalin manual")}
          value={manual}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.target.select()}
        />
      )}
      {confirm && (
        <EndDialog onCancel={() => setConfirm(false)} onConfirm={endTransfer} />
      )}
    </>
  );
}
