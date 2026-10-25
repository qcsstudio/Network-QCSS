export const ciscoNetworking = `version 17.15
hostname synthetic-router
router ospf 1
 auto-cost reference-bandwidth 10000
 log-adjacency-changes detail
interface GigabitEthernet0/0
 zone-member security INSIDE
interface Tunnel10
 tunnel protection ipsec profile OFFICE
crypto ikev2 proposal PROPOSAL
 encryption aes-cbc-256
 integrity sha256
 group 14 19
crypto ikev2 policy POLICY
 proposal PROPOSAL
crypto ipsec profile OFFICE
 set ikev2-profile PEER
crypto ikev2 keyring KEYS
 peer OFFICE
  pre-shared-key NetworkingSecretCanary
end`;

export const ciscoSwitching = `version 17.15
hostname synthetic-switch
interface GigabitEthernet1/0/1
 channel-protocol lacp
 lacp rate fast
 switchport nonegotiate
 spanning-tree guard root
end`;

export const fortiNetworking = `#config-version=FGT-TEST-7.4.9-FW-build0000-000000:opmode=0
config system interface
 edit bundle
  set type aggregate
  set lacp-mode active
  set lacp-speed fast
  set min-links 2
  set min-links-down operational
 next
end
config router bgp
 set ebgp-multipath enable
 set ibgp-multipath disable
 set log-neighbour-changes enable
 set graceful-restart enable
 config neighbor
  edit 192.0.2.2
   set prefix-list-in RECEIVED
   set prefix-list-out ADVERTISED
   set route-map-in INBOUND
   set route-map-out OUTBOUND
  next
 end
end
config firewall address
 edit OFFICE
  set subnet 192.0.2.0 255.255.255.0
 next
end
config firewall policy
 edit 10
  set srcaddr OFFICE
  set srcaddr-negate enable
  set dstaddr all
  set dstaddr-negate disable
  set service HTTPS
  set service-negate enable
  set fixedport enable
  set logtraffic-start enable
  set match-vip enable
  set send-deny-packet disable
 next
end
config vpn ipsec phase1-interface
 edit OFFICE
  set interface bundle
  set dpd on-demand
  set dpd-retrycount 3
  set nattraversal forced
  set fragmentation enable
  set negotiate-timeout 30
  set reauth disable
  set add-route enable
  set psksecret ENC NetworkingSecretCanary
 next
end
config vpn ipsec phase2-interface
 edit OFFICE-SELECTOR
  set phase1name OFFICE
  set pfs enable
  set replay enable
  set auto-negotiate enable
  set keylife-type both
  set keylifeseconds 3600
  set keylifekbs 5120
  set protocol 6
  set src-port 0
  set dst-port 443
 next
end`;
