// Mock API facade. Domain implementations live under features/*/testing.

export {
  batchTransition,
  confirmCancelledOrderReturn,
  correctTerminalOrder,
  createOrder,
  createOrderWorkflowStatus,
  decideOrderApproval,
  getOrder,
  getOrderStats,
  listOrderWorkflow,
  listOrders,
  listOrdersPage,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  reopenOrder,
  reorderOrderWorkflowStatuses,
  sendApprovalRequest,
  sendNotification,
  sendWhatsappNotification,
  setOrderWorkflowStatusEnabled,
  transitionOrder,
  updateOrder,
  voidOrder,
  updateOrderWorkflowStatus,
  updateOrderWorkflowTransitions,
  uploadOrderAttachment,
} from "@/features/orders/testing/mock-api";

export {
  completeCustomerFollowup,
  createCustomer,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDetail,
  getCustomerDevices,
  listCustomers,
  listCustomersPage,
  searchCustomerIntakeCandidates,
  searchCustomers,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "@/features/customers/testing/mock-api";

export {
  applyElectronicsCsvImport,
  accessInventoryAttachment,
  createInventoryIntake,
  finalizeBuybackPurchase,
  getInventoryItem,
  getInventoryStats,
  getInventorySummary,
  importElectronicsCsvPreview,
  listInventoryItems,
  listInventoryItemsPage,
  recordInventoryCheck,
  recordInventoryTransaction,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
  uploadInventoryAttachment,
} from "@/features/inventory/testing/mock-api";

export {
  getStoreSettings,
  listMessageTemplates,
  renderMessageTemplatePreview,
  resetMessageTemplate,
  updateMessageTemplate,
  updateStoreSettings,
} from "@/features/messages/testing/mock-api";

export {
  acceptKioskSession,
  createKioskDevicePairing,
  createKioskSession,
  getKioskPublicSession,
  listKioskDevices,
  listKioskSessions,
  pairKioskDevice,
  returnKioskSession,
  revokeKioskDevice,
  submitKioskPublicSession,
} from "@/features/kiosk/testing/mock-api";

export {
  acceptStoreInvitation,
  approveStoreAccessRequest,
  createStore,
  createStoreInviteLink,
  getStoreContext,
  inviteStoreMember,
  listStoreAccessRequests,
  listStoreMembers,
  redeemStoreInviteLink,
  rejectStoreAccessRequest,
  revokeStoreInviteLink,
  revokeStoreInvitation,
  switchActiveStore,
} from "@/features/stores/testing/mock-api";

export { allTechnicians, customers, devices, suppliers } from "@/lib/mock/state";

export type {
  CreateOrderInput,
  OrderListFilters,
  OrderListItem,
  OrderListPageInput,
  OrderListResult,
} from "@/lib/repairdesk/types";
