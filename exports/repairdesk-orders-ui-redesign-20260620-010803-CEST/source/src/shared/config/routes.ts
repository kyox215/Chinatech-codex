export const appRoutes = {
  home: "/",
  orders: "/orders",
  newOrder: "/orders/new",
  orderDetail: (id: string) => `/orders/${id}`,
  orderTask: (id: string) => `/orders/${id}/task`,
  customers: "/customers",
  customerDetail: (id: string) => `/customers/${id}`,
  inventory: "/inventory",
  messages: "/messages",
  settings: "/settings",
} as const;
