// Mock API facade. Domain implementations live under features/*/testing.

export {
  batchTransition,
  createOrder,
  getOrder,
  getOrderStats,
  listOrders,
  listOrdersPage,
  patchOrder,
  patchOrderFinance,
  recordPayment,
  sendApprovalRequest,
  sendNotification,
  sendWhatsappNotification,
  transitionOrder,
  updateOrder,
} from "@/features/orders/testing/mock-api";

export {
  completeCustomerFollowup,
  createCustomer,
  createCustomerFollowup,
  deleteCustomerDevice,
  getCustomerDetail,
  getCustomerDevices,
  listCustomers,
  searchCustomers,
  sendCustomerMessage,
  setCustomerTags,
  updateCustomer,
  upsertCustomerDevice,
} from "@/features/customers/testing/mock-api";

export {
  applyElectronicsCsvImport,
  createInventoryIntake,
  getInventoryItem,
  getInventoryStats,
  importElectronicsCsvPreview,
  listInventoryItems,
  listInventoryItemsPage,
  recordInventoryCheck,
  recordInventoryTransaction,
  sellInventoryItem,
  transitionInventoryItem,
  updateInventoryItem,
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
  createStore,
  getStoreContext,
  inviteStoreMember,
  listStoreMembers,
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
