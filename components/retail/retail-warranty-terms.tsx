import { retailStatutoryRights, retailWarrantyTerms } from "@/lib/retail-warranty-terms";
import styles from "./retail-warranty.module.css";

export function RetailWarrantyTerms({ enabled = true }: { enabled?: boolean }) {
  return <details className={styles.terms}><summary>查看保修条款</summary><ul>{(enabled ? retailWarrantyTerms : retailWarrantyTerms.slice(-1)).map(term => <li key={term.title}><strong>{term.title}</strong><p>{term.zh}</p></li>)}</ul><p>{retailStatutoryRights.zh}</p></details>;
}
