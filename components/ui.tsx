"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  AlertCircle,
  FileImage,
  FileText,
  Film,
  FileArchive,
  File,
  Clock3,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "./language";
export function FileName({ name }: { name: string }) {
  const { t } = useLanguage();
  return (
    <details className="file-details">
      <summary aria-label={t(`Detail file ${name}`)}>
        <span className="file-name">{name}</span>
        <ChevronDown size={14} />
      </summary>
      <p className="full-filename">
        {t("Nama lengkap:")} {name}
      </p>
    </details>
  );
}
export function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const Icon =
    ext && ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)
      ? FileImage
      : ext && ["mp4", "mov"].includes(ext)
        ? Film
        : ext === "zip"
          ? FileArchive
          : ext && ["pdf", "txt", "csv", "docx", "xlsx", "pptx"].includes(ext)
            ? FileText
            : File;
  return (
    <span className={`file-icon ${Icon === FileImage ? "image-icon" : ""}`}>
      <Icon size={21} aria-hidden="true" />
    </span>
  );
}
export function ErrorNotice({ message, id }: { message: string; id?: string }) {
  const { t } = useLanguage();
  return message ? (
    <div className="notice error" role="alert" id={id}>
      <AlertCircle size={18} aria-hidden="true" />
      <span>{t(message)}</span>
    </div>
  ) : null;
}
export function Countdown({
  expiresAt,
  serverTime,
  onEnd,
}: {
  expiresAt: string;
  serverTime: string;
  onEnd?: () => void;
}) {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      Math.ceil((Date.parse(expiresAt) - Date.parse(serverTime)) / 1000),
    ),
  );
  const onExpired = useEffectEvent(() => onEnd?.());
  useEffect(() => {
    const started = performance.now();
    const duration = Date.parse(expiresAt) - Date.parse(serverTime);
    let notified = false;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((duration - (performance.now() - started)) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0 && !notified) {
        notified = true;
        onExpired();
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, serverTime]);
  return (
    <span
      className={`countdown ${remaining === 0 ? "ended" : ""}`}
      aria-live="off"
    >
      <Clock3 size={15} aria-hidden="true" />
      {remaining === 0
        ? t("Transfer berakhir")
        : t(
            `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")} tersisa`,
          )}
    </span>
  );
}
export function EndDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      queueMicrotask(() => {
        if (
          opener instanceof HTMLElement &&
          opener.isConnected &&
          !opener.closest("[hidden]")
        )
          opener.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="dialog confirm-dialog"
      aria-labelledby="end-title"
      aria-describedby="end-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="end-title">{t("Akhiri transfer?")}</h2>
      <p id="end-description">
        {t(
          "Kode dan tautan baru akan ditutup. Tautan unduh yang sudah diterbitkan mungkin masih berlaku sebentar. Salinan yang sudah diunduh tidak dapat ditarik kembali.",
        )}{" "}
      </p>
      <div className="dialog-actions">
        <button className="secondary" autoFocus onClick={onCancel}>
          {t("Tetap bagikan")}{" "}
        </button>
        <button className="primary" onClick={onConfirm}>
          {t("Ya, akhiri")}{" "}
        </button>
      </div>
    </dialog>
  );
}
