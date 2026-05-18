import Link from "next/link";
import type { ReactNode } from "react";

export type FieldHelpContent = {
  title: string;
  body: string;
  href: string;
  linkLabel?: string;
};

export function FieldHelpTip({ help }: { help: FieldHelpContent }) {
  return (
    <span className="field-help">
      <span className="field-help-trigger" tabIndex={0} aria-label={`Help for ${help.title}`}>
        ?
      </span>
      <span className="field-help-popover" role="tooltip">
        <strong>{help.title}</strong>
        <span>{help.body}</span>
        <Link href={help.href}>{help.linkLabel ?? "Open lesson"}</Link>
      </span>
    </span>
  );
}

export function FieldLabel({
  children,
  help
}: {
  children: ReactNode;
  help: FieldHelpContent;
}) {
  return (
    <span className="label field-help-label">
      <span>{children}</span>
      <FieldHelpTip help={help} />
    </span>
  );
}
