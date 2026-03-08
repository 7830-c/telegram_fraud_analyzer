export interface ChannelMetadata {
  channel_name?: string;
  description?: string | null;
  member_count?: string | number | null;
  verification_status?: string | boolean | null;
  profile_photo_present?: boolean;
  [k: string]: unknown;
}

export interface MessageAnalysis {
  message_red_flags?: string[];
  message_summary?: string;
  [k: string]: unknown;
}

export interface OutboundLink {
  url: string;
  label: "safe" | "suspicious" | "phishing";
  reason?: string;
}

export interface AdminCrossCheck {
  admin_visible?: boolean;
  admin_username_or_name?: string | null;
  cross_platform_match?: string | null;
  [k: string]: unknown;
}

export interface WalletAddress {
  address: string;
  risk: "low" | "medium" | "high";
  reason?: string;
}

export interface FraudReport {
  channel_metadata?: ChannelMetadata;
  message_analysis?: MessageAnalysis;
  outbound_links?: OutboundLink[];
  admin_cross_check?: AdminCrossCheck;
  wallet_addresses?: WalletAddress[];
  evidence?: string[];
  fraud_risk_score?: number;
  conclusion?: "legitimate" | "suspicious" | "likely_fraud";
  limited_data_note?: string;
  [k: string]: unknown;
}
