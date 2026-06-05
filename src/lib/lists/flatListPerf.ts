import type { FlatListProps } from "react-native";

/** Sensible defaults for medium-sized list rows on mobile. */
export const FLATLIST_PERF_DEFAULTS = {
  windowSize: 7,
  initialNumToRender: 12,
  maxToRenderPerBatch: 10,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: true,
} as const satisfies Partial<FlatListProps<unknown>>;

/** Chat list row — avatar 48 + vertical padding ~16 each side. */
export const CHAT_LIST_ROW_HEIGHT = 80;

export function chatListGetItemLayout(_data: unknown, index: number) {
  return {
    length: CHAT_LIST_ROW_HEIGHT,
    offset: CHAT_LIST_ROW_HEIGHT * index,
    index,
  };
}

/** Saved payment method card row (padding + brand box). */
export const PAYMENT_METHOD_ROW_HEIGHT = 88;

export function paymentMethodGetItemLayout(_data: unknown, index: number) {
  return {
    length: PAYMENT_METHOD_ROW_HEIGHT,
    offset: PAYMENT_METHOD_ROW_HEIGHT * index,
    index,
  };
}

/** Notification inbox row (icon + title + body preview). */
export const NOTIFICATION_ROW_HEIGHT = 88;

export function notificationRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: NOTIFICATION_ROW_HEIGHT,
    offset: NOTIFICATION_ROW_HEIGHT * index,
    index,
  };
}

/** Wallet / booking transaction row. */
export const TRANSACTION_ROW_HEIGHT = 76;

export function transactionRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: TRANSACTION_ROW_HEIGHT,
    offset: TRANSACTION_ROW_HEIGHT * index,
    index,
  };
}

/** Friends / requests list card. */
export const FRIEND_ROW_HEIGHT = 80;

export function friendRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: FRIEND_ROW_HEIGHT,
    offset: FRIEND_ROW_HEIGHT * index,
    index,
  };
}

/** Trainer students roster row. */
export const STUDENT_ROW_HEIGHT = 76;

export function studentRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: STUDENT_ROW_HEIGHT,
    offset: STUDENT_ROW_HEIGHT * index,
    index,
  };
}

/** Wallet ledger activity row. */
export const WALLET_LEDGER_ROW_HEIGHT = 70;

export function walletLedgerRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: WALLET_LEDGER_ROW_HEIGHT,
    offset: WALLET_LEDGER_ROW_HEIGHT * index,
    index,
  };
}

/** Community user row (avatar + name). */
export const COMMUNITY_ROW_HEIGHT = 72;

export function communityRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: COMMUNITY_ROW_HEIGHT,
    offset: COMMUNITY_ROW_HEIGHT * index,
    index,
  };
}

/** Book Expert trainer card — approximate fixed height for virtualization. */
export const TRAINER_BROWSE_ROW_HEIGHT = 168;

/** Instant booking online-trainer row. */
export const INSTANT_BOOKING_ROW_HEIGHT = 88;

export function instantBookingRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: INSTANT_BOOKING_ROW_HEIGHT,
    offset: INSTANT_BOOKING_ROW_HEIGHT * index,
    index,
  };
}

export function trainerBrowseRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: TRAINER_BROWSE_ROW_HEIGHT,
    offset: TRAINER_BROWSE_ROW_HEIGHT * index,
    index,
  };
}

/** Blocked users settings row (avatar + meta + button). */
export const BLOCKED_USER_ROW_HEIGHT = 72;

export function blockedUserRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: BLOCKED_USER_ROW_HEIGHT,
    offset: BLOCKED_USER_ROW_HEIGHT * index,
    index,
  };
}

/** Trainer promo code card row. */
export const PROMO_ROW_HEIGHT = 132;

export function promoRowGetItemLayout(_data: unknown, index: number) {
  return {
    length: PROMO_ROW_HEIGHT,
    offset: PROMO_ROW_HEIGHT * index,
    index,
  };
}

export function createFixedRowGetItemLayout(height: number) {
  return (_data: unknown, index: number) => ({
    length: height,
    offset: height * index,
    index,
  });
}
