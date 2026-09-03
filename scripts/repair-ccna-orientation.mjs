import { getPrismaClient } from "../src/lib/prisma.ts";
import { ccnaLessonContentSchema, evaluateCcnaLessonQuality } from "../src/lib/ccna-lesson-schema.ts";

// A reviewed, one-time correction. Dry-run is the default; existing edits win on conflict.
const revision = "2026-09-03-gns3-orientation-review";
const prisma = getPrismaClient();
try {
  const lesson = await prisma.ccnaLesson.findUniqueOrThrow({ where: { sequence: 1 } });
  if (lesson.slug !== "ccna-roadmap-and-lab-method" || lesson.status !== "published") {
    throw new Error("This correction applies only to the published orientation lesson.");
  }
  const trace = lesson.generationTrace || {};
  if (trace.operatorReview?.revision === revision) {
    console.log("Orientation correction already applied.");
  } else {
    const content = ccnaLessonContentSchema.parse(lesson.content);
    const firstTopology = "https://docs.gns3.com/docs/getting-started/your-first-gns3-topology";
    const switchReference = "https://docs.gns3.com/docs/using-gns3/advanced/hubs-and-switches";
    const v11Reference = "https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf";
    const canonical = (value) => {
      const url = new URL(value);
      for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
      return url.toString();
    };
    content.sources = content.sources.map((source) => ({ ...source, url: canonical(source.url), supports: source.supports.replace(/^Yes for /, "Evidence for ") }));
    const topologySource = content.sources.find((source) => source.url.endsWith("/your-first-cisco-topology"));
    if (!topologySource || content.sections.length !== 6 || content.lab.steps.length !== 7) {
      throw new Error("The orientation content has changed; review the correction before applying it.");
    }
    topologySource.url = firstTopology;
    topologySource.label = "GNS3: Your First GNS3 Topology";
    topologySource.supports = "Two VPCS endpoints, built-in switch links, IP configuration, peer ping and saving startup configuration.";
    for (const section of content.sections) {
      section.sourceUrls = section.sourceUrls.map((url) => canonical(url).endsWith("/your-first-cisco-topology") ? firstTopology : canonical(url));
    }
    content.sources.push({ label: "Cisco CCNA 200-301 v1.1 Exam Topics", url: v11Reference, supports: "Current exam domains and their exact weights; separate from the announced v2.0 blueprint." });
    content.sections[0].sourceUrls = content.sections[0].sourceUrls.filter((url) => !url.includes("v2.0"));
    content.sections[0].sourceUrls.push(v11Reference);
    content.sections[0].explanation = "The current CCNA 200-301 v1.1 exam covers Network Fundamentals (20%), Network Access (20%), IP Connectivity (25%), IP Services (10%), Security Fundamentals (15%), and Automation and Programmability (10%). Cisco says v1.1 remains available through February 2, 2027; v2.0 starts February 3, 2027. Use the blueprint for your planned exam date. Both versions require practical understanding, not just definitions. QCS arranges these lessons from simple observations to configuration and troubleshooting; that teaching order is not an official Cisco study timetable.";
    content.sections[1].explanation = "GNS3 includes VPCS, a lightweight simulator of a PC's network behavior, and a built-in Ethernet switch. They let you learn without a Cisco software image. VPCS accepts commands for IP addressing, ping tests and saving settings; it is not a full Windows or Linux desktop. The switch forwards Ethernet frames. It also supports VLAN port modes through GNS3 settings, but this first lab leaves both used ports in the same default access segment. No VLAN configuration is required here. A feature left unused in a lesson is not a feature missing from the device.";
    content.sections[1].keyPoints[0] = "VPCS is included with standard GNS3 desktop installations; confirm it is available and can start on your selected server.";
    content.sections[2].explanation += " Think of an IP address as a host's address and the subnet mask as the boundary of its local neighborhood. Here /24 means mask 255.255.255.0: 192.168.10.1 and 192.168.10.2 are local peers. No router or default gateway is needed between them. A successful ping shows that ICMP requests and replies passed at that moment; it does not prove Internet access or application performance.";
    content.sections[3].sourceUrls = [firstTopology, "https://docs.gns3.com/docs/emulators/vpcs"];
    content.sections[5].explanation = "This first lab needs no Cisco IOS image: the built-in switch and VPCS are enough. Later exercises may require a Cisco router or switch appliance. GNS3 does not supply Cisco images. Obtain any needed software through an authorized source and check that its license permits the intended platform and use. Owning hardware or downloading a file does not automatically grant every virtualization right. Cisco Modeling Labs is an official alternative for running Cisco labs within its licensed environment; do not assume its images may be exported to GNS3. These licensing checks apply when you reach a lesson that actually needs those appliances.";
    content.sections[5].sourceUrls = ["https://docs.gns3.com/docs/troubleshooting-faq/where-do-i-get-ios-images"];
    content.sections[5].example = "For today's two-PC exercise, start with the built-in devices. Before a later router lab, check its appliance requirements and software terms; choose an authorized GNS3 image or run that exercise within a licensed Cisco Modeling Labs environment.";
    content.lab.setup = [
      "Create a new isolated GNS3 project named CCNA-Day-01. Do not connect it to your home or production network.",
      "Add two built-in VPCS nodes named PC1 and PC2 and one built-in Ethernet switch named SW1.",
      "Use Add a Link: connect PC1 Ethernet0 to SW1 Ethernet0, then PC2 Ethernet0 to SW1 Ethernet1.",
      "Keep both used switch ports in the same default access segment. This lab does not change VLAN settings.",
      "Start both VPCS nodes and open their consoles. Confirm which console is PC1 and which is PC2 before typing."
    ];
    for (const row of content.lab.addressing) row.interface = "Ethernet0";
    content.lab.steps[5].instruction = "In the PC2 console only, restore address 192.168.10.2 with mask 255.255.255.0, then use show ip to confirm the correction. Do not use PC2's self-ping as proof of the link.";
    content.lab.steps[5].commands = ["ip 192.168.10.2 255.255.255.0", "show ip"];
    content.lab.steps[5].expectedResult = "PC2 displays 192.168.10.2/24 again. This verifies its local configuration; the next step tests the link from PC1.";
    content.lab.steps.splice(6, 0, {
      title: "Verify Recovery from PC1",
      instruction: "Switch to the PC1 console. Ping PC2 at 192.168.10.2 and compare the result with the failed test. Keep the replies as evidence of restored peer connectivity.",
      commands: ["ping 192.168.10.2"],
      expectedResult: "PC1 receives ICMP replies from PC2 after the address correction. This is a peer test, not a self-ping.",
      why: "Testing from the other endpoint proves the correction restored the intended path through the switch, rather than just checking PC2's local stack."
    });
    content.lab.verification[1] = "On PC1 run ping 192.168.10.2; on PC2 run ping 192.168.10.1. Record both results as basic bidirectional ICMP evidence.";
    content.lab.cleanup = ["Save both VPCS configurations and keep your notes, then stop the nodes.", "Keep the working project for revision. Delete only a disposable copy if you intentionally want to rebuild the lab."];
    content.lab.licensingNote = "This lab uses GNS3's built-in VPCS and Ethernet switch, so no Cisco image is required. GNS3 does not provide Cisco images for later appliance labs. Use software whose license permits your intended platform, or run the exercise inside Cisco Modeling Labs under its terms; a CML license does not automatically permit exporting its images to GNS3.";
    content.glossary.find((item) => item.term === "Built-in Ethernet Switch").meaning = "A GNS3 Layer 2 switch that forwards Ethernet frames and has configurable port modes. This lab uses one shared access segment.";
    content.practiceQuestions[4].answer = "It forwards Ethernet frames between the two PC connections on their shared access segment; it does not route between their IP subnets.";
    content.practiceQuestions[4].explanation = "The PCs use the switch as a Layer 2 path. Its VLAN port modes exist, but this beginner lab does not change them or need a Cisco switch CLI.";
    content.quiz[1].question = "In this lab, with both used switch ports left in the same access segment, what is the switch's role?";
    content.quiz[1].options[1] = "Automatically corrects the PCs' subnet masks";
    content.quiz[1].explanation = "It forwards Ethernet frames between the PCs. It does not assign their IP settings or route between subnets. VLAN port modes are supported but unused here.";
    content.quiz[2].question = "In this isolated lab with no router or default gateway, PC1 is 192.168.10.1/24 and PC2 is 192.168.20.2/24. What happens to a peer ping?";
    const corrected = ccnaLessonContentSchema.parse(content);
    const quality = evaluateCcnaLessonQuality(corrected);
    if (!quality.ready) throw new Error(quality.issues.join(" "));
    if (process.argv.includes("--apply")) {
      const result = await prisma.ccnaLesson.updateMany({ where: { id: lesson.id, updatedAt: lesson.updatedAt }, data: {
        content: corrected,
        sources: corrected.sources,
        qualityScore: quality.score,
        generationTrace: { ...trace, quality, operatorReview: { revision, reviewedAt: new Date().toISOString(), priorRevision: lesson.updatedAt.toISOString(), sources: [firstTopology, switchReference, v11Reference], labExecution: "Documentation and command-context review; not executed in GNS3." } }
      } });
      if (result.count !== 1) throw new Error("Another operator changed this lesson; no correction was applied.");
    }
    console.log(JSON.stringify({ applied: process.argv.includes("--apply"), lessonId: lesson.id, usefulWords: quality.usefulWords, issues: quality.issues, labSteps: corrected.lab.steps.length }));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Orientation repair failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  process.exit(process.exitCode || 0);
}
