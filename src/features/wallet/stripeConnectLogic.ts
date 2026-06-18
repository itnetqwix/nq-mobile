export function parseStripeConnectMessage(msg: string): StripeConnectStatus {
  return {
    complete: /completed successfully/i.test(msg) && !/not completed/i.test(msg),
    message: msg,
  };
}

export type StripeConnectStatus = {
  complete?: boolean;
  message?: string;
};
