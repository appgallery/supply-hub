export const MESSAGE = {
  REGISTER_SUCCESS: "User registered successfully.",
  LOGIN_SUCCESS: "Login successful.",
  LOGOUT_SUCCESS: "Logout successful.",

  USER_ALREADY_EXISTS: "User already exists.",
  USER_NOT_FOUND: "User not found.",

  INVALID_CREDENTIALS: "Invalid email or password.",

  ROLE_NOT_FOUND: "Role not found.",

  UNAUTHORIZED: "Unauthorized.",

  TOKEN_EXPIRED: "Token has expired.",

  INVALID_TOKEN: "Invalid token.",

  SOMETHING_WENT_WRONG: "Something went wrong.",
};

export const TOKEN = {
  ACCESS_EXPIRES_IN: "1h",
  REFRESH_EXPIRES_IN: "7d",
};

export enum MediaType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
}

export enum SellerType {
  CLIENT = "CLIENT",
  SUB_CLIENT = "SUB_CLIENT",
}
export enum Role  {
  SUPER_ADMIN = "superadmin",
  CLIENT = "client",
  SUB_CLIENT = "subclient"
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum ActivityType {
    CLIENT_CREATED = "CLIENT_CREATED",
    SUB_CLIENT_CREATED = "SUB_CLIENT_CREATED",
    PRODUCT_CREATED = "PRODUCT_CREATED",
    ORDER_CREATED = "ORDER_CREATED",
    ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED",
    CLIENT_UPDATED = "CLIENT_UPDATED",
    CLIENT_DELETED = "CLIENT_DELETED",
    SUB_CLIENT_UPDATED="SUB_CLIENT_UPDATED",
    SUB_CLIENT_DELETED="SUB_CLIENT_DELETED"
}

export enum TaxType {
  GST = "GST",
  VAT = "VAT",
  SALES_TAX = "SALES_TAX",
}
