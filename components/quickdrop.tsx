"use client";
import { useSyncExternalStore, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Layers2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Send } from "./send";
import { Receive } from "./receive";
import { LanguageSwitch, useLanguage } from "./language";
import { DeviceTransferIllustration } from "./device-transfer-illustration";

function subscribeMode(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("quickdrop:mode", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("quickdrop:mode", callback);
  };
}
const getMode = () => window.location.search;
const getServerMode = () => "";

export function QuickDrop({ receiveOnly = false }: { receiveOnly?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const search = useSyncExternalStore(subscribeMode, getMode, getServerMode);
  const tab =
    receiveOnly || new URLSearchParams(search).get("mode") === "receive"
      ? "receive"
      : "send";
  function selectMode(mode: "send" | "receive") {
    if (receiveOnly) {
      if (mode === "send") router.push("/");
      return;
    }
    if (mode !== tab) {
      window.history.pushState(
        null,
        "",
        mode === "receive" ? "/?mode=receive" : "/",
      );
      window.dispatchEvent(new Event("quickdrop:mode"));
    }
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    let next: "send" | "receive";
    if (event.key === "Home") next = "send";
    else if (event.key === "End") next = "receive";
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      next = tab === "send" ? "receive" : "send";
    else return;
    event.preventDefault();
    selectMode(next);
    if (!receiveOnly) document.getElementById(`${next}-tab`)?.focus();
  }
  return (
    <div className={`site-shell ${receiveOnly ? "receive-page" : ""}`}>
      <div className="ambient-scene" aria-hidden="true">
        <span className="ambient-glow glow-violet" />
        <span className="ambient-glow glow-pink" />
        <span className="ambient-glow glow-cyan" />
        <span className="glass-orb orb-violet" />
        <span className="glass-orb orb-cyan" />
        <span className="prism-ring ring-left" />
        <span className="prism-ring ring-right" />
      </div>
      <a className="skip-link" href="#transfer">
        {t("Langsung ke transfer")}{" "}
      </a>
      <header className="site-header">
        <Link
          className="brand"
          href="/"
          aria-label={t("QuickDrop beranda")}
          translate="no"
        >
          <span className="brand-mark">
            <Layers2 size={23} strokeWidth={1.7} />
          </span>
          QuickDrop<span className="brand-dot">.</span>
        </Link>
        <LanguageSwitch />
      </header>
      <main className="main-grid">
        <section className="intro">
          <h1>
            {receiveOnly ? (
              <>
                {t("File untukmu.")} <br />
                <em>{t("Siap diunduh.")}</em>
              </>
            ) : (
              <>
                {t("File kamu.")} <br />
                <em>{t("Lintas perangkat.")}</em>
              </>
            )}
          </h1>
          <p className="tagline">
            {receiveOnly
              ? t("Masukkan kode atau buka tautan dari pengirim.")
              : t("Kirim file. Bagikan kode. Unduh di perangkat lain.")}
            <br className="desktop-break" />
            <span className="desktop-copy">
              {" "}
              {t("Tanpa login, tanpa mengurangi kualitas.")}{" "}
            </span>
          </p>
          <DeviceTransferIllustration />
          <div className="feature-row">
            <div>
              <ShieldCheck size={20} />
              <span>
                <strong>{t("Kualitas asli")}</strong>
                <small>{t("Tanpa kompresi")}</small>
              </span>
            </div>
            <div>
              <ScanLine size={20} />
              <span>
                <strong>{t("Kode atau QR")}</strong>
                <small>{t("Pilih cara berbagi")}</small>
              </span>
            </div>
          </div>
        </section>
        <section
          id="transfer"
          className="transfer-panel"
          aria-label={t("Transfer file")}
          tabIndex={-1}
        >
          <div
            className="tab-bar"
            role="tablist"
            aria-label={t("Pilih mode transfer")}
          >
            <button
              id="send-tab"
              role="tab"
              aria-selected={tab === "send"}
              aria-controls="send-panel"
              tabIndex={tab === "send" ? 0 : -1}
              className={tab === "send" ? "active" : ""}
              onClick={() => selectMode("send")}
              onKeyDown={moveTab}
            >
              <ArrowUpRight size={18} /> {t("Kirim")}{" "}
            </button>
            <button
              id="receive-tab"
              role="tab"
              aria-selected={tab === "receive"}
              aria-controls="receive-panel"
              tabIndex={tab === "receive" ? 0 : -1}
              className={tab === "receive" ? "active" : ""}
              onClick={() => selectMode("receive")}
              onKeyDown={moveTab}
            >
              <ArrowDownLeft size={18} /> {t("Terima")}{" "}
            </button>
          </div>
          <div className="panel-content">
            <div
              id="send-panel"
              role="tabpanel"
              aria-labelledby="send-tab"
              hidden={tab !== "send"}
            >
              {!receiveOnly && <Send />}
            </div>
            <div
              id="receive-panel"
              role="tabpanel"
              aria-labelledby="receive-tab"
              hidden={tab !== "receive"}
            >
              <Receive fromLink={receiveOnly} />
            </div>
          </div>
          <div className="panel-bottom">
            <ShieldCheck size={15} />
            <span>{t("Sementara di sini. Sepenuhnya milikmu.")}</span>
          </div>
        </section>
        <section className="how-it-works" aria-label={t("Cara berbagi file")}>
          <span>{t("SESEDERHANA INI")}</span>
          <ol>
            <li>
              <b>1</b>
              <span>{t("Pilih file")}</span>
            </li>
            <li>
              <b>2</b>
              <span>{t("Bagikan kode")}</span>
            </li>
            <li>
              <b>3</b>
              <span>{t("Unduh")}</span>
            </li>
          </ol>
        </section>
      </main>
      <footer className="brand-footer">
        <details id="privacy" className="privacy-note">
          <summary>
            {t("Yang perlu kamu tahu")}{" "}
            <span>{t("Privasi & batas penggunaan")}</span>
          </summary>
          <div className="privacy-content">
            <div>
              <h2>{t("Singgah sebentar.")}</h2>
              <p>
                {t(
                  "1–5 file, maksimal 25 MB per file dan 50 MB total. Transfer berlaku 30 menit sejak seluruh file siap. Siapa pun yang memiliki kode atau tautan dapat mengunduh.",
                )}{" "}
              </p>
            </div>
            <div>
              <h2>{t("Bagikan dengan sadar.")}</h2>
              <p>
                {t(
                  "File biasanya dibersihkan dalam 10 menit setelah transfer berakhir; gangguan layanan dapat memperlambat penghapusan. Metadata jalur sementara dipertahankan lebih lama untuk membersihkan upload terlambat.",
                )}{" "}
              </p>
              <p>
                {t(
                  "Layanan tidak memindai malware dan tidak memakai enkripsi end-to-end. Hindari dokumen rahasia. Salinan yang sudah diunduh tidak dapat ditarik kembali.",
                )}{" "}
              </p>
            </div>
          </div>
        </details>
        <p className="creator-credit" translate="no">
          Created by Christopher Cuangdinata.
        </p>
      </footer>
    </div>
  );
}
