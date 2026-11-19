import type { ToolkitOperation } from "./types";
import { packetOperation, pathOperation } from "./imports-packet-path";
import { performanceOperation } from "./imports-performance";
import { dnsOperation, logsOperation } from "./imports-dns-logs";
import { tlsOperation, exposureOperation } from "./imports-tls-exposure";

export const importOperations: ToolkitOperation[] = [
  packetOperation, pathOperation, performanceOperation, dnsOperation, tlsOperation, logsOperation, exposureOperation,
];

for (const operation of importOperations) {
  operation.format += operation.id === "tls"
    ? " Import limits: 32 KiB UTF-8; one certificate, at most 200 SAN entries and 2000 output rows. JSON/XML item and depth limits do not apply to PEM."
    : " Import limits: 1 MiB UTF-8; 2000 items per container and 2000 output rows; 60000 values; 24 nesting levels. Any lower format-specific limits above also apply. Oversized inputs are rejected, not truncated.";
}
