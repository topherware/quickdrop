"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ArrowDownLeft,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { formatBytes as formatFileBytes } from "@/lib/shared/config";
import { normalizeCode } from "@/lib/shared/validation";
import type { ReceiveResponse } from "@/lib/shared/types";
import { api, ClientError } from "@/lib/client/api";
import { Countdown, ErrorNotice, FileIcon, FileName } from "./ui";
import { useLanguage } from "./language";

export function Receive({ fromLink = false }: { fromLink?: boolean }) {
  const { t, language } = useLanguage();
  const formatBytes = (bytes: number) =>
    formatFileBytes(bytes, language === "en" ? "en-US" : "id-ID");
  const [code, setCode] = useState(""),
    [transfer, setTransfer] = useState<ReceiveResponse | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [invalid, setInvalid] = useState(false);
  const [downloading, setDownloading] = useState(""),
    [feedback, setFeedback] = useState(""),
    [expired, setExpired] = useState(false);
  const [hasLink, setHasLink] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<"input" | "result" | null>(null);
  const exchange = useRef<{
    token: string;
    promise?: Promise<ReceiveResponse>;
  } | null>(null);
  const grantKeys = useRef<Record<string, string>>({});
  useEffect(() => {
    if (busy || !focusNext.current) return;
    const target =
      focusNext.current === "result" ? heading.current : input.current;
    if (target && !target.closest("[hidden]")) {
      target.focus();
      focusNext.current = null;
    }
  }, [busy, error, transfer, expired]);
  useEffect(() => {
    if (!fromLink) return;
    if (!exchange.current) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      window.history.replaceState(null, "", "/receive");
      if (!token) return;
      exchange.current = { token };
    }
    const current = exchange.current;
    current.promise ??= api<ReceiveResponse>("/api/transfers/exchange", {
      method: "POST",
      data: { token: current.token },
    });
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) {
        setBusy(true);
        setHasLink(true);
        setFeedback("Membuka transfer…");
      }
    });
    current.promise
      .then((data) => {
        if (alive) {
          focusNext.current = "result";
          setTransfer(data);
          setFeedback(`${data.files.length} file siap diunduh.`);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setFeedback("");
          focusNext.current = "input";
        }
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [fromLink]);
  async function lookup() {
    if (busy) return;
    if (!(hasLink && !code) && normalizeCode(code).length !== 8) {
      setInvalid(true);
      setError("Masukkan kode 8 digit dari pengirim.");
      focusNext.current = "input";
      return;
    }
    setBusy(true);
    setInvalid(false);
    setError("");
    setFeedback("Mencari file…");
    try {
      const response =
        exchange.current && !code
          ? await api<ReceiveResponse>("/api/transfers/exchange", {
              method: "POST",
              data: { token: exchange.current.token },
            })
          : await api<ReceiveResponse>("/api/transfers/lookup", {
              method: "POST",
              data: { code },
            });
      focusNext.current = "result";
      setTransfer(response);
      setExpired(false);
      setFeedback(`${response.files.length} file siap diunduh.`);
    } catch (e) {
      setError((e as Error).message);
      setFeedback("");
      focusNext.current = "input";
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    if (!transfer || expired || downloading) return;
    setDownloading(id);
    setError("");
    setFeedback(
      `Menyiapkan unduhan ${transfer.files.find((f) => f.id === id)?.name ?? "file"}. Tunggu sebentar sebelum memilih file lain.`,
    );
    const key = grantKeys.current[id] ?? crypto.randomUUID();
    grantKeys.current[id] = key;
    try {
      const result = await api<{ downloadUrl: string; validUntil: string }>(
        `/api/files/${id}/download`,
        { method: "POST", data: {}, token: transfer.receiveToken, key },
      );
      const anchor = document.createElement("a");
      anchor.href = result.downloadUrl;
      anchor.download = transfer.files.find((f) => f.id === id)?.name ?? "file";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      delete grantKeys.current[id];
      setFeedback("Unduhan dimulai. Periksa daftar unduhan di browser.");
    } catch (e) {
      if (e instanceof ClientError && e.code === "QD_GRANT_EXPIRED")
        delete grantKeys.current[id];
      setError((e as Error).message);
      setFeedback("");
    } finally {
      setDownloading("");
      requestAnimationFrame(() => {
        const button = document.getElementById(`download-${id}`);
        if (button && !button.closest("[hidden]"))
          button.focus({ preventScroll: true });
      });
    }
  }
  return (
    <>
      <div className="card-heading">
        <div>
          <span className="eyebrow">{t("KE PERANGKAT INI")}</span>
          <h2 ref={heading} tabIndex={-1}>
            {transfer ? t("File untukmu.") : t("Terima file.")}
          </h2>
        </div>
        <span className="mode-symbol" aria-hidden="true">
          <ArrowDownLeft size={21} />
        </span>
      </div>
      {transfer ? (
        <div className="received-state">
          <div className="received-summary">
            <span>
              {t(
                `${transfer.files.length} file · ${formatBytes(transfer.totalBytes)}`,
              )}
            </span>
            <Countdown
              expiresAt={transfer.expiresAt}
              serverTime={transfer.serverTime}
              onEnd={() => {
                if (document.activeElement?.closest("#receive-panel"))
                  focusNext.current = "result";
                setExpired(true);
                setFeedback("");
              }}
            />
          </div>
          <ErrorNotice
            message={
              expired
                ? t(
                    "Transfer sudah berakhir. Minta pengirim membuat transfer baru.",
                  )
                : error
            }
            id="receive-error"
          />
          <div className="file-list">
            {transfer.files.map((file) => (
              <div key={file.id} className="file-row">
                <FileIcon name={file.name} />
                <div className="file-meta">
                  <FileName name={file.name} />
                  <span>
                    {formatBytes(file.size)} ·{" "}
                    {file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
                <button
                  id={`download-${file.id}`}
                  className="download-button"
                  aria-label={t(`Unduh ${file.name}`)}
                  aria-describedby={
                    downloading === file.id ? "receive-feedback" : undefined
                  }
                  disabled={expired || !!downloading}
                  onClick={() => download(file.id)}
                >
                  {downloading === file.id ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <ArrowDownToLine size={18} />
                  )}
                  <span>
                    {downloading === file.id ? t("Menyiapkan…") : t("Unduh")}
                  </span>
                </button>
              </div>
            ))}
          </div>
          <p className="card-footnote">
            {t("Unduh satu per satu. Kualitas file tetap asli.")}{" "}
          </p>
          <button
            className="text-button"
            disabled={!!downloading}
            onClick={() => {
              focusNext.current = "input";
              setTransfer(null);
              setCode("");
              setError("");
              setFeedback("");
              setHasLink(false);
              setInvalid(false);
              exchange.current = null;
            }}
          >
            <RotateCcw size={16} /> {t("Cari transfer lain")}{" "}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          aria-busy={busy}
        >
          <p className="receive-intro">
            {t("Masukkan kode dari perangkat pengirim.")}{" "}
          </p>
          <label className="input-label" htmlFor="transfer-code">
            {t("Kode transfer")}{" "}
          </label>
          <div className={`code-input-wrap ${invalid ? "invalid" : ""}`}>
            <KeyRound size={21} aria-hidden="true" />
            <input
              ref={input}
              id="transfer-code"
              name="transfer-code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="0000 0000"
              value={code}
              maxLength={24}
              onChange={(e) => {
                const normalized = normalizeCode(e.target.value);
                if (/^\d{0,8}$/.test(normalized)) {
                  setCode(
                    normalized.length > 4
                      ? `${normalized.slice(0, 4)} ${normalized.slice(4)}`
                      : normalized,
                  );
                  setInvalid(false);
                  setError("");
                }
              }}
              aria-describedby={error ? "code-help receive-error" : "code-help"}
              aria-invalid={invalid || undefined}
              disabled={busy}
            />
          </div>
          <p id="code-help" className="input-help">
            {t("8 digit, termasuk angka nol di depan.")}{" "}
          </p>
          <ErrorNotice message={error} id="receive-error" />
          <button
            className="primary"
            disabled={busy || (!hasLink && normalizeCode(code).length !== 8)}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={19} />{" "}
                {t("Mencari file…")}{" "}
              </>
            ) : (
              <>
                {t("Cari file")} <ArrowUpRight size={20} />
              </>
            )}
          </button>
          <div className="receive-note">
            <ScanLine size={20} />
            <p>
              {t(
                "Punya QR? Pindai dengan kamera perangkat untuk membuka transfer langsung.",
              )}{" "}
            </p>
          </div>
        </form>
      )}
      <p
        id="receive-feedback"
        role="status"
        aria-live="polite"
        className="feedback"
      >
        {t(feedback)}
      </p>
    </>
  );
}
