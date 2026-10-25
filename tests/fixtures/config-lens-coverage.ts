export const ciscoServices = `version 17.15
hostname CoverageLab
ip dhcp excluded-address 192.0.2.1 192.0.2.20
ip dhcp pool OFFICE
 network 192.0.2.0 255.255.255.0
 default-router 192.0.2.1
 dns-server 192.0.2.53 192.0.2.54
 domain-name example.test
 lease 2 12 30
 unsupported-option keep-visible
!
ip name-server 192.0.2.53
ip domain name example.test
no ip domain lookup
interface GigabitEthernet1/0/1
 spanning-tree portfast
 spanning-tree bpduguard enable
 spanning-tree bpdufilter enable
end`;

export const fortiServices = `#config-version=FGT30G-7.4.9-FW-build0000-000000:opmode=0
config system interface
 edit port1
  set ip 192.0.2.1 255.255.255.0
 next
end
config system dhcp server
 edit 1
  set status enable
  set interface port1
  set default-gateway 192.0.2.1
  set netmask 255.255.255.0
  set dns-service specify
  set dns-server1 192.0.2.53
  set lease-time 86400
  config ip-range
   edit 1
    set start-ip 192.0.2.100
    set end-ip 192.0.2.150
   next
  end
  config reserved-address
   edit 1
    set ip 192.0.2.120
    set mac 02:00:00:00:00:01
   next
  end
 next
end
config system dns
 set primary 192.0.2.53
 set secondary 192.0.2.54
 set protocol dot
 set source-ip 192.0.2.1
 set unsupported-option keep-visible
end
config system ntp
 set ntpsync enable
 set type custom
 set syncinterval 60
 set server-mode disable
 config ntpserver
  edit 1
   set server time.example.test
   set key CoverageSecretCanary
  next
 end
end
config system sdwan
 config members
  edit 1
   set interface port1
   set zone UNDERLAY
   set gateway 192.0.2.254
   set cost 10
   set priority 1
  next
 end
 config health-check
  edit Monitor
   set server 192.0.2.254
   set protocol ping
   set interval 1000
   set members 1
  next
 end
end
config log syslogd setting
 set status enable
 set server 192.0.2.200
 set format cef
end
config log syslogd filter
 set severity warning
 set forward-traffic enable
 set local-traffic enable
end
config system ha
 set session-pickup enable
 set session-pickup-connectionless enable
end`;
