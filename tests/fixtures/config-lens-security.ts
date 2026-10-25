export const ciscoPortSecurity = `version 17.15
hostname LAB
interface GigabitEthernet1/0/1
 switchport mode access
 switchport port-security
 switchport port-security aging time 10
 switchport port-security aging type inactivity
 switchport port-security aging static
 switchport port-security mac-address sticky
 switchport port-security violation restrict
 switchport port-security unsupported-security-option
!
username lab secret SecuritySecretCanary
end`;

export const ciscoCertificateVpn = `version 17.15
hostname LAB
crypto ikev2 profile BRANCH
 lifetime 600
 pki trustpoint LAB-CA verify
 unsupported-security-option
!
username lab secret SecuritySecretCanary
end`;

export const fortiSecurity = `#config-version=FGVM64-7.4.9-build0000
config system switch-interface
 edit "LAB-SWITCH"
  set intra-switch-policy explicit
  set member "port2" "port3"
  set span enable
  set span-dest-port "port4"
  set span-source-port "port2"
  set span-direction both
  set type switch
 next
end
config firewall vip
 edit "LAB-WEB"
  set extip 192.0.2.10
  set mappedip 10.0.0.10
  set arp-reply enable
  set nat-source-vip disable
  set portmapping-type 1-to-1
  set srcintf-filter "port1"
 next
end
config vpn ipsec phase1-interface
 edit "BRANCH"
  set passive-mode enable
  set fragmentation-mtu 1200
  set psksecret SecuritySecretCanary
  set unsupported-security-option enable
 next
end`;
