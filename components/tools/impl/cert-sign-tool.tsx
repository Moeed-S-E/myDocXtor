"use client";

import * as React from "react";
import { TOOLS_BY_SLUG } from "@/lib/tools";
import { FileCard } from "@/components/file/file-card";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "../controls";
import { ToolWorkspace, type ToolRenderArgs, type LoadedFile } from "../tool-workspace";
import { useMainThreadRunner } from "../use-main-thread-runner";
import { fileToBytes } from "../file-bytes";
import { bytesToPdfBlob } from "@/lib/download";
import { readCertificate, certVisualSign, type CertInfo } from "@/engines/cert-sign";
import { getPageCount } from "@/engines/pdf-lib-ops";
import { toUserMessage } from "@/lib/errors";

export function CertSignTool() {
  const tool = TOOLS_BY_SLUG["cert-sign"]!;
  const runner = useMainThreadRunner();
  const [current, setCurrent] = React.useState<LoadedFile | null>(null);
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [p12, setP12] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState("");
  const [cert, setCert] = React.useState<CertInfo | null>(null);
  const [page, setPage] = React.useState(1);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const onFilesChange = React.useCallback((files: LoadedFile[]) => {
    setCurrent(files[0] ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!current) return setPageCount(null);
    (async () => {
      try {
        const n = await getPageCount(await fileToBytes(current.file));
        if (active) setPageCount(n);
      } catch {
        if (active) setPageCount(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [current]);

  const loadCert = async () => {
    setLocalError(null);
    setCert(null);
    if (!p12) return;
    try {
      const bytes = await fileToBytes(p12);
      const info = readCertificate(bytes, password);
      setCert(info);
    } catch (err) {
      setLocalError(toUserMessage(err).title);
    }
  };

  const main = ({ files, removeFile }: ToolRenderArgs) => {
    const f = files[0];
    if (!f) return null;
    return (
      <div className="flex flex-col gap-3">
        <FileCard name={f.file.name} size={f.file.size} pageCount={pageCount ?? undefined} onRemove={() => removeFile(f.id)} />
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Honest limit:</strong> this stamps a
          <em> visual</em> signature attributed to your certificate and reads its
          identity on-device. It does not embed a cryptographic PKCS#7 signature
          dictionary, so it is not a verifiable digital signature. Your private
          key never leaves this tab.
        </div>
        {cert && (
          <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm">
            <p className="font-medium text-success">Certificate loaded</p>
            <p>{cert.commonName}{cert.organization ? ` · ${cert.organization}` : ""}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Valid {cert.notBefore} → {cert.notAfter}
            </p>
          </div>
        )}
      </div>
    );
  };

  const options = ({ files, setResult }: ToolRenderArgs) => {
    const sign = async () => {
      const f = files[0];
      if (!f || !cert) return;
      const bytes = await fileToBytes(f.file);
      try {
        const out = await runner.run((onProgress, signal) =>
          certVisualSign(
            bytes,
            cert,
            { page, x: 360, y: 60, width: 200 },
            onProgress,
            signal,
          ),
        );
        setResult({
          outputs: [
            {
              bytes: out,
              blob: bytesToPdfBlob(out),
              filename: f.file.name.replace(/\.pdf$/i, "-cert-signed.pdf"),
            },
          ],
          inputBytes: f.file.size,
        });
      } catch {
        /* surfaced via runner.error */
      }
    };

    return (
      <>
        <Field label="Certificate (.p12 / .pfx)">
          <input
            type="file"
            accept=".p12,.pfx,application/x-pkcs12"
            onChange={(e) => setP12(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>
        <Field label="Certificate password">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button variant="outline" onClick={loadCert} disabled={!p12}>
          Load certificate
        </Button>
        {localError && <p className="text-sm text-danger">{localError}</p>}
        <Field label="Page" hint={pageCount ? `of ${pageCount}` : undefined}>
          <TextInput
            type="number"
            min={1}
            max={pageCount ?? undefined}
            value={page}
            onChange={(e) => setPage(Math.max(1, Number(e.target.value)))}
          />
        </Field>
        <Button onClick={sign} disabled={!cert || files.length === 0}>
          Apply visual signature
        </Button>
      </>
    );
  };

  return (
    <ToolWorkspace
      tool={tool}
      status={runner.status}
      progress={runner.progress}
      error={runner.error}
      onCancel={runner.cancel}
      onReset={runner.reset}
      onFilesChange={onFilesChange}
      renderMain={main}
      renderOptions={options}
    />
  );
}
