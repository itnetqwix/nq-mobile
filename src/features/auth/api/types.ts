export type LoginResponse = {
  msg?: string;
  result?: {
    data?: {
      access_token?: string;
      account_type?: string;
    };
  };
};

export type SignUpPayload = {
  fullname: string;
  email: string;
  password: string;
  mobile_no: string;
  account_type: string;
  category?: string | null;
  tcpa?: boolean;
  isGoogleRegister?: boolean;
};

export type MasterRow = {
  category?: string[];
  [key: string]: unknown;
};
