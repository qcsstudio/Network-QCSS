import { getNetworkSupportSchemaGraph, metadataConfig } from "@/data/networkSupportPage";
import NetworkSupportServicesPage from "@/container/network-support-services/NetworkSupportServicesPage";

export const metadata = metadataConfig;

export default function Page() {
  const schemaGraph = getNetworkSupportSchemaGraph();

  return (
    <NetworkSupportServicesPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
      />
    </NetworkSupportServicesPage>
  );
}
