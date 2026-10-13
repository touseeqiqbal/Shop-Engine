"use client";
import Link from "next/link";
import type { DefaultCellComponentProps } from "payload";

/** Customer list cells: name + email link, account badge, role. */

export function CustomerNameCell({ rowData, cellData }: DefaultCellComponentProps) {
  return (
    <Link className="urko-ocell" href={`/cms/collections/users/${rowData.id}`}>
      <strong>{String(cellData || rowData.email || "—")}</strong>
      <small>{rowData.blocked ? "Blocked · " : ""}{String(rowData.email ?? "")}</small>
    </Link>
  );
}

const STAFF: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export function AccountCell({ cellData, rowData }: DefaultCellComponentProps) {
  if (STAFF[String(rowData.role)]) return <span className="urko-badge urko-badge--b">{STAFF[String(rowData.role)]}</span>;
  return cellData === false ? (
    <span className="urko-badge urko-badge--n" title="Made from a guest order – no password yet">
      Guest
    </span>
  ) : (
    <span className="urko-badge urko-badge--g">Account</span>
  );
}
