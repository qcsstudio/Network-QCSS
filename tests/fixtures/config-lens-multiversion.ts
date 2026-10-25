export const fortiExpanded = `config system interface
 edit port1
  set mode dhcp
  set defaultgw enable
  set dns-server-override disable
  set distance 10
  set dhcp-relay-service enable
  set dhcp-relay-ip 192.0.2.50 192.0.2.51
  set device-identification enable
  set secondary-IP enable
  set lldp-reception vdom
  set lldp-transmission disable
  set estimated-upstream-bandwidth 100000
  set estimated-downstream-bandwidth 200000
  set unknown-interface-option keep-visible
  config secondaryip
   edit 1
    set ip 192.0.2.2 255.255.255.0
    set allowaccess ping https
   next
  end
 next
end
config system dhcp server
 edit 1
  set interface port1
  set dns-service specify
  set dns-server3 192.0.2.53
  set conflicted-ip-timeout 1800
  set ntp-service specify
  set ntp-server1 192.0.2.123
  set ntp-server2 192.0.2.124
  set timezone-option default
  config exclude-range
   edit 1
    set start-ip 192.0.2.20
    set end-ip 192.0.2.30
   next
  end
  config reserved-address
   edit 1
    set mac 02:00:00:00:00:01
    set action block
   next
  end
 next
end
config system dns
 set primary 192.0.2.53
 set timeout 5
 set retry 2
 set dns-cache-limit 5000
 set dns-cache-ttl 1800
 set fqdn-cache-ttl 3600
 set fqdn-min-refresh 60
end
config system admin
 edit local-admin
  set password ExpandedSecretCanary
 next
end`;

export const ciscoExpanded = `hostname ExpandedLab
service dhcp
ip dhcp bootp ignore
ip dhcp pool OFFICE
 network 192.0.2.0 /24
 bootfile client.img
 next-server 192.0.2.10
 netbios-name-server 192.0.2.11
 netbios-node-type h-node
 utilization mark high 80 log
 import all
 unknown-dhcp-option keep-visible
!
interface GigabitEthernet0/1
 no ip redirects
 no ip unreachables
 no ip proxy-arp
 description ExpandedSecretCanary
end`;
