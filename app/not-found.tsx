"use client";
import Link from "next/link";
import { LanguageSwitch, useLanguage } from "@/components/language";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="not-found">
      <LanguageSwitch />
      <h1>{t("Halaman tidak ditemukan.")}</h1>
      <Link href="/">{t("Kembali ke QuickDrop")}</Link>
    </main>
  );
}
