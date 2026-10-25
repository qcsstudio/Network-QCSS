// Synthetic export only. No customer configuration or usable credentials.
export const fortinetFullBackup = String.raw`#config-version=FGT30G-7.4.9-FW-build2933-TEST
config system password-policy
    set status enable
end
config system interface
    edit "port1"
        set ip 192.0.2.1 255.255.255.0
        set alias "HiddenAliasCanary"
        set allowaccess ping https
    next
end
config system replacemsg admin
    edit "pre_admin-disclaimer-text"
        set buffer "<p title=\"Demo\">HiddenBufferCanary
next
end
config system interface
edit \"GhostInterface\"
interface FakeCiscoInterface
<p>Quoted text, not a device command.</p>"
    next
end
config system snmp community
    edit 1
        set name "HiddenCommunityCanary"
        config hosts
            edit 1
                set ip 192.0.2.20 255.255.255.255
            next
        end
    next
end
config vpn certificate local
    edit "test-certificate"
        set password ENC HiddenPasswordCanary
        set private-key "-----BEGIN PRIVATE KEY-----
HiddenPrivateKeyCanary
-----END PRIVATE KEY-----"
        set certificate "-----BEGIN CERTIFICATE-----
HiddenCertificateCanary
-----END CERTIFICATE-----"
    next
end
config system automation-action
    edit "test-action"
        set script "HiddenScriptCanary
config system interface
edit port1
next
end"
    next
end
config system admin
    edit "password-HiddenEntryCanary"
        set password ENC HiddenSecondPasswordCanary
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
        set dstintf "any"
        set srcaddr "OfficeSubnet"
        set dstaddr "all"
        set action accept
        set service "HTTPS"
    next
end`;
