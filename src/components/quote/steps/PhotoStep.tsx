"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuote } from "@/lib/quote/quote-provider";
import { mediaErrorMessage, validateFile } from "@/lib/quote/media/media-adapter";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";

export function PhotoStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  if (!quote) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(mediaErrorMessage(validationError));
      updateQuote({ photo: { status: "failed", reason: mediaErrorMessage(validationError) } });
      return;
    }

    setError(null);
    const previewObjectUrl = URL.createObjectURL(file);
    updateQuote({
      photo: {
        status: "selected",
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
        previewObjectUrl,
      },
    });
    analytics.track({ name: "photo_uploaded" });
  }

  function handleSkip() {
    setError(null);
    updateQuote({ photo: { status: "skipped" } });
    analytics.track({ name: "photo_skipped" });
    router.push("/quote/style");
  }

  function handleContinue() {
    router.push("/quote/style");
  }

  const photo = quote.photo;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Picture your space
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Optional. Your photo is previewed on this device only and is not
        uploaded to Servino at this time.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {photo.status === "selected" ? (
        <div className="mt-6 rounded-2xl border border-border p-4">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewObjectUrl}
              alt="Your uploaded wall"
              className="max-h-64 w-full rounded-xl object-cover"
            />
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal text-white shadow-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <p className="mt-3 truncate text-sm text-ink-muted">{photo.fileName}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark sm:order-2"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:border-ink/20 sm:order-1"
            >
              Choose a different photo
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          {error && <p className="mb-3 text-sm text-coral-text">{error}</p>}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-white px-6 py-10 text-center transition-colors hover:border-purple/40 hover:bg-purple-light/30"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-light text-purple">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-base font-semibold text-ink">Upload Photo</span>
            <span className="text-xs text-ink-muted">JPG, PNG, or WEBP — up to 8MB</span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-border px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:border-ink/20 sm:w-auto"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
