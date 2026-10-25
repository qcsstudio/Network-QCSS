import { ciscoNetworking, fortiNetworking } from "./config-lens-networking";

export const fortiReleaseCoverage = fortiNetworking
  .replace("set route-map-out OUTBOUND", "set route-map-out OUTBOUND\n   set next-hop-self enable\n   set soft-reconfiguration enable\n   set route-reflector-client enable\n   set send-community both")
  .replace("set fixedport enable", "set fixedport enable\n  set anti-replay enable\n  set tcp-session-without-syn data-only")
  .replace("set dpd on-demand", "set dpd on-demand\n  set keylife 86400\n  set ike-version 2")
  .replace("set pfs enable", "set pfs enable\n  set keepalive enable");

export const ciscoReleaseCoverage = ciscoNetworking
  .replace("zone-member security INSIDE", "ip ospf cost 10\n ip ospf hello-interval 10\n ip ospf dead-interval 40\n ip ospf priority 0")
  .replace("set ikev2-profile PEER", "unsupported-profile-option")
  .replace("integrity sha256", "integrity sha256\n prf sha256 sha512")
  .replace("crypto ikev2 keyring KEYS", "crypto ikev2 profile PEER\n keyring local KEYS\n authentication local pre-share\n authentication remote rsa-sig\ncrypto ikev2 keyring KEYS");
