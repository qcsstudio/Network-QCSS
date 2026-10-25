export const ciscoRoutePolicy = `version 17.15
hostname LAB
ip prefix-list OFFICE seq 5 permit 192.0.2.0/24
ip prefix-list SUMMARY seq 10 permit 10.0.0.0/8 ge 16 le 24
route-map IMPORT permit 10
 match ip address prefix-list OFFICE SUMMARY
 match tag 100 200
 match metric 20
 set local-preference 200
 set tag 300
 set unsupported-policy-option 1
!
username lab secret RoutePolicySecretCanary
end`;

export const fortiRoutePolicy = `#config-version=FGVM64-7.4.9-build0000
config router prefix-list
 edit "OFFICE"
  config rule
   edit 1
    set action permit
    set prefix 10.0.0.0 255.0.0.0
    set ge 16
    set le 24
   next
  end
 next
end
config router route-map
 edit "IMPORT"
  config rule
   edit 10
    set action permit
    set match-ip-address "OFFICE"
    set match-ip-nexthop "NEXT-HOPS"
    set match-tag 100
    set match-metric 20
    set set-local-preference 200
    set set-weight 300
    set set-tag 400
    set set-metric 30
    set set-ip-nexthop 192.0.2.1
    set unsupported-policy-option enable
   next
  end
 next
end
config system admin
 edit "lab"
  set password RoutePolicySecretCanary
 next
end`;
