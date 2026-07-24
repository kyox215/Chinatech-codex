export {
  CUSTOMER_STATUS_LEGACY_TOKEN_PATTERN,
  CUSTOMER_STATUS_STABLE_TOKEN_PATTERN,
  CUSTOMER_STATUS_TOKEN_PATTERN,
} from "@/entities/customer-status/model/customer-status-link";
export const CUSTOMER_STATUS_LINK_UNAVAILABLE_MESSAGE =
  "Questo link non è disponibile. Contatta il negozio per assistenza.";

export type CustomerStatusStage =
  | "received"
  | "diagnosing"
  | "quote"
  | "parts"
  | "repair"
  | "pickup"
  | "done"
  | "cancelled"
  | "in_progress";

export interface CustomerStatusPublicView {
  store: {
    name: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  order: {
    public_no: string;
    device: string;
    stage: CustomerStatusStage;
    stage_label: string;
    progress_percent: number;
    last_updated_at: string;
    next_action: string;
  };
}

export interface CustomerStatusIssuedLink {
  order_id: string;
  url: string;
  expires_at: string | null;
}

const customerStageByBucket: Record<
  string,
  Pick<
    CustomerStatusPublicView["order"],
    "stage" | "stage_label" | "progress_percent" | "next_action"
  >
> = {
  intake: {
    stage: "received",
    stage_label: "Dispositivo ricevuto",
    progress_percent: 12,
    next_action: "Il negozio prenderà in carico il dispositivo.",
  },
  diagnosing: {
    stage: "diagnosing",
    stage_label: "Diagnosi in corso",
    progress_percent: 28,
    next_action: "Attendi l'esito della diagnosi o il preventivo.",
  },
  diagnosis: {
    stage: "diagnosing",
    stage_label: "Diagnosi in corso",
    progress_percent: 28,
    next_action: "Attendi l'esito della diagnosi o il preventivo.",
  },
  quote: {
    stage: "quote",
    stage_label: "Preventivo in preparazione",
    progress_percent: 42,
    next_action: "Il negozio ti contatterà se è necessaria un'approvazione.",
  },
  parts: {
    stage: "parts",
    stage_label: "In attesa dei ricambi",
    progress_percent: 56,
    next_action: "La lavorazione riprenderà quando arriveranno i ricambi.",
  },
  repair: {
    stage: "repair",
    stage_label: "Riparazione in corso",
    progress_percent: 72,
    next_action: "Attendi il completamento della riparazione.",
  },
  pickup: {
    stage: "pickup",
    stage_label: "Pronto per il ritiro",
    progress_percent: 90,
    next_action: "Contatta il negozio o passa per il ritiro.",
  },
  done: {
    stage: "done",
    stage_label: "Ordine completato",
    progress_percent: 100,
    next_action: "Conserva la ricevuta per la garanzia.",
  },
  cancelled: {
    stage: "cancelled",
    stage_label: "Ordine chiuso",
    progress_percent: 100,
    next_action: "Contatta il negozio se hai bisogno di assistenza.",
  },
  custom: {
    stage: "in_progress",
    stage_label: "Lavorazione in corso",
    progress_percent: 50,
    next_action: "Contatta il negozio per maggiori informazioni.",
  },
};

const legacyBucketByStatus: Record<string, string> = {
  new: "intake",
  rework: "intake",
  diagnosing: "diagnosing",
  quoted: "quote",
  waiting_approval: "quote",
  parts_ordered: "parts",
  parts_arrived: "parts",
  repairing: "repair",
  mail_in_progress: "intake",
  repaired: "pickup",
  notified: "pickup",
  unfixed_pickup: "pickup",
  waiting_pickup: "pickup",
  completed: "done",
  cancelled: "cancelled",
};

export function getCustomerStatusStage(bucket?: string | null, legacyStatus?: string | null) {
  const normalizedBucket = bucket?.trim().toLowerCase();
  const fallbackBucket = legacyBucketByStatus[legacyStatus?.trim().toLowerCase() ?? ""];
  return (
    customerStageByBucket[normalizedBucket || fallbackBucket || ""] ?? customerStageByBucket.custom
  );
}
