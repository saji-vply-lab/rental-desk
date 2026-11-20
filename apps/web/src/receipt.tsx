import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReceiptDocument } from "@rentaldesk/shared";
import { headers } from "./owner-access";
function whatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (/^0\d{10}$/.test(digits)) return "91" + digits.slice(1);
  return digits.length === 10 ? "91" + digits : digits;
}
type Preview = {
  doc: ReceiptDocument;
  phones: string[];
  file: File;
  url: string;
};
function ReceiptDialog({
  rental,
  documentKey,
  close,
}: {
  rental: number;
  documentKey: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, P] = useState<Preview>(),
    [phone, S] = useState(""),
    [error, E] = useState(""),
    [attempt, A] = useState(0);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    let url = "";
    const controller = new AbortController();
    E("");
    async function load() {
      const r = await fetch(
        "/api/rental-drafts/" +
          rental +
          "/receipts/" +
          documentKey +
          "?format=preview",
        { headers: headers(), signal: controller.signal },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.message || "Could not load receipt.");
      const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
      const file = new File([bytes], data.doc.reference + ".pdf", {
        type: "application/pdf",
      });
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(file);
      P({ ...data, file, url });
      S(data.phones[0] ?? "");
    }
    load().catch((err) => {
      if (!controller.signal.aborted) E(err.message);
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [rental, documentKey, attempt]);
  const shareText = preview
    ? [
        preview.doc.shop,
        preview.doc.title + " · " + preview.doc.reference,
        preview.doc.rental + " · " + preview.doc.date,
        preview.doc.customer,
        ...preview.doc.lines,
        preview.doc.footer,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const nativeFile =
    preview &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [preview.file] });
  return createPortal(
    <dialog
      className="receipt-dialog"
      ref={dialog}
      aria-labelledby="receipt-title"
      onCancel={close}
    >
      <div className="receipt-toolbar">
        <button type="button" onClick={close}>
          Close receipt
        </button>
      </div>
      {preview ? (
        <>
          <article className="receipt-paper">
            <small>{preview.doc.shop}</small>
            <h2 id="receipt-title">{preview.doc.title}</h2>
            <p>
              <strong>{preview.doc.reference}</strong> · {preview.doc.date}
            </p>
            <p>
              {preview.doc.customer}
              {preview.doc.rental !== preview.doc.reference
                ? " · " + preview.doc.rental
                : ""}
            </p>
            <div className="receipt-lines">
              {preview.doc.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
            {preview.doc.footer && <p>{preview.doc.footer}</p>}
          </article>
          <div className="receipt-toolbar">
            <a href={preview.url} download={preview.file.name}>
              Download PDF
            </a>
            <button type="button" onClick={() => window.print()}>
              Print
            </button>
            {nativeFile && (
              <button
                type="button"
                onClick={() =>
                  navigator
                    .share({ files: [preview.file], title: preview.doc.title })
                    .catch((err) => {
                      if (err.name !== "AbortError")
                        E(
                          "Sharing was unavailable. Download the PDF to attach it.",
                        );
                    })
                }
              >
                Share PDF
              </button>
            )}
            {preview.phones.length > 0 && (
              <label>
                Customer phone{" "}
                <select value={phone} onChange={(e) => S(e.target.value)}>
                  <option value="">Choose contact in WhatsApp</option>
                  {preview.phones.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}
            <a
              href={
                "https://wa.me/" +
                whatsAppNumber(phone) +
                "?text=" +
                encodeURIComponent(shareText)
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Share summary via WhatsApp
            </a>
            <small>
              {nativeFile
                ? "Choose WhatsApp in Share PDF to send the file."
                : "To share the file, download the PDF and attach it in WhatsApp."}
            </small>
          </div>
        </>
      ) : (
        <h2 id="receipt-title">
          {error ? "Receipt unavailable" : "Preparing receipt…"}
        </h2>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          {!preview && <button onClick={() => A(attempt + 1)}>Retry</button>}
        </p>
      )}
    </dialog>,
    document.body,
  );
}
export function ReceiptButton({
  rental,
  documentKey,
  label,
}: {
  rental: number;
  documentKey: string;
  label: string;
}) {
  const [open, O] = useState(false);
  return (
    <>
      <button type="button" onClick={() => O(true)}>
        {label}
      </button>
      {open && (
        <ReceiptDialog
          rental={rental}
          documentKey={documentKey}
          close={() => O(false)}
        />
      )}
    </>
  );
}
