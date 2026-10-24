export const samples: Record<string, string> = {
  "cisco-router": `version 17.9
hostname LabRouter
interface GigabitEthernet0/0
 ip address 192.0.2.1 255.255.255.0
 ip access-group OFFICE-IN in
 no shutdown
!
ip access-list extended OFFICE-IN
 permit tcp 192.0.2.0 0.0.0.255 any eq 443
 deny ip any any
!
ip route 0.0.0.0 0.0.0.0 198.51.100.1
router ospf 10
 network 192.0.2.0 0.0.0.255 area 0
!
username demo secret 9 DEMO-NOT-A-REAL-SECRET
end`,
  "cisco-switch": `version 17.9
hostname LabSwitch
vlan 10
 name OFFICE
!
interface GigabitEthernet1/0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
!
interface GigabitEthernet1/0/24
 switchport mode trunk
 switchport trunk allowed vlan 10,20
!
interface Vlan10
 ip address 192.0.2.1 255.255.255.0
 no shutdown
!
ip routing
end`,
  "cisco-nexus": `version 10.4(1)
hostname LabNexus
feature interface-vlan
vlan 10
 name OFFICE
!
interface Ethernet1/1
 switchport
 switchport mode access
 switchport access vlan 10
!
interface Vlan10
 ip address 192.0.2.1/24
 no shutdown
end`,
  "cisco-asa": `ASA Version 9.20(2)
hostname LabFirewall
interface GigabitEthernet0/0
 nameif inside
 security-level 100
 ip address 192.0.2.1 255.255.255.0
 no shutdown
!
object network OFFICE
 subnet 192.0.2.0 255.255.255.0
 nat (inside,outside) dynamic interface
!
access-list OFFICE-IN extended permit tcp object OFFICE any eq 443
access-group OFFICE-IN in interface inside
route outside 0.0.0.0 0.0.0.0 198.51.100.1 1
end`,
  "cisco-ftd": `NGFW Version 7.4.2
hostname LabThreatDefense
interface GigabitEthernet0/0
 nameif inside
 ip address 192.0.2.1 255.255.255.0
 no shutdown
!
route outside 0.0.0.0 0.0.0.0 198.51.100.1 1
end`,
  fortigate: `#config-version=FGVM64-7.6.0-FW-build3401
config system interface
 edit "port1"
  set ip 192.0.2.1 255.255.255.0
  set allowaccess ping https ssh
 next
 edit "port2"
  set ip 198.51.100.2 255.255.255.0
 next
end
config firewall address
 edit "OfficeSubnet"
  set subnet 192.0.2.0 255.255.255.0
 next
end
config firewall policy
 edit 10
  set srcintf "port1"
  set dstintf "port2"
  set srcaddr "OfficeSubnet"
  set dstaddr "all"
  set action accept
  set service "HTTPS"
  set schedule "always"
  set nat enable
 next
end
config router static
 edit 1
  set dst 0.0.0.0 0.0.0.0
  set gateway 198.51.100.1
  set device "port2"
 next
end
config system admin
 edit "demo-admin"
  set password ENC DEMO-NOT-A-REAL-SECRET
 next
end`,
  fortiweb: `config system interface
 edit "port1"
  set ip 192.0.2.20 255.255.255.0
 next
end
config server-policy vserver
 edit "PublicWeb"
  set ip 192.0.2.50
 next
end
config server-policy server-pool
 edit "WebBackends"
  set protocol HTTP
  set lb-algo round-robin
 next
end
config server-policy policy
 edit "WebsitePolicy"
  set vserver "PublicWeb"
  set server-pool "WebBackends"
  set web-protection-profile "ReviewedProfile"
 next
end`,
  fortiswitch: `config switch vlan
 edit 10
 next
end
config switch interface
 edit "port1"
  set native-vlan 10
  set allowed-vlans 10 20
  set stp-state enabled
 next
end
config system interface
 edit "internal"
  set ip 192.0.2.2 255.255.255.0
  set allowaccess ping https ssh
 next
end`
};
