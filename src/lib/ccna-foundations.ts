export type CcnaFoundationUnit = {
  id: string;
  title: string;
  outcome: string;
  paragraphs: string[];
  steps: string[];
  question: string;
  answer: string;
};

export const ccnaFoundationUnits: CcnaFoundationUnit[] = [
  {
    id: "computer",
    title: "What a computer does",
    outcome: "Recognize the machine, the instructions it follows, and the information it uses.",
    paragraphs: [
      "A computer is a machine that follows instructions. A laptop, a desktop computer and a smartphone are all computers. When you type a message, the keyboard supplies input: information going in. A program works with that information. The screen gives output: a result you can see. Input, work and output are three useful ideas to remember.",
      "Hardware means the physical parts. The screen, keyboard and the parts inside a laptop are hardware. Software means the programs that tell those parts what to do. A calculator app is software. The same phone can run a calculator, a camera app and a web browser because it can follow different programs.",
      "The processor carries out instructions. Memory holds information the computer is using right now. Storage keeps saved information for later. Think of memory as a work surface and storage as a cupboard. This is only a comparison: real computers store information electronically, not as paper. Unsaved work can be lost when an app closes or power is lost, so save important work.",
      "An operating system is the main software that manages the device and helps you open other programs. Windows, macOS, Android and iOS are examples. You do not need to install a different operating system for this course. You can read on a phone; later hands-on network labs need a suitable computer."
    ],
    steps: ["Look at the device you are using. Identify its screen and the way you enter information: keyboard, touch screen or both.", "Name one physical part and one app. Say which is hardware and which is software.", "Open the calculator app already on your device. Enter 2 + 3 and choose equals. The numbers are input; 5 is the output."],
    question: "Is a photo-viewing app hardware or software? What about the screen?",
    answer: "The app is software: instructions that help show the photo. The screen is hardware: the physical part that displays it. Both are involved when you look at a photo."
  },
  {
    id: "click-and-type",
    title: "Click, tap, type and read the screen",
    outcome: "Follow an instruction without guessing what its action words mean.",
    paragraphs: [
      "On a computer, move the mouse or slide a finger on the touchpad to move the pointer. Click means press and release the main mouse button once. Double-click means do that twice quickly. Drag means hold the button while moving, then release it. On a phone, a tap is one brief touch. Not every desktop action has an identical phone action.",
      "A button is a control you activate, often by clicking or tapping. A text field is a space where you can type. Click inside a text field first so your typing goes to the correct place. The blinking line is the text cursor. Backspace usually removes the character before that line. A space is the gap made by the Space bar.",
      "A menu is a list of choices. Scroll means move through content that does not all fit on the screen. You can use a mouse wheel, a touchpad gesture or a swipe. A window is an area containing an app. A tab usually lets one app hold more than one open page or view.",
      "Enter is a key that may confirm an action or start a new line, depending on the app. In a network console, it usually asks the device to run the command you typed. Always check which window has your attention before typing. In the practice below, you can also reach the field and button with the Tab key."
    ],
    steps: ["Find the field labelled Practice message below. Click or tap inside it.", "Type Hello. Add a space, then type network. If you make a typing mistake, move the text cursor and use Backspace.", "Choose Send practice message. Compare what you typed with the received message. This exercise stays in your browser; it does not send a real network message."],
    question: "Why should you click inside the correct field before typing?",
    answer: "The selected field or window receives your typing. Selecting the right place helps prevent text or a command going to the wrong app or device."
  },
  {
    id: "files-and-apps",
    title: "Apps, files, folders and saving your work",
    outcome: "Keep your notes somewhere you can find again.",
    paragraphs: [
      "A file is a named collection of information, such as a photo, document or saved project. A folder groups files. An app opens or changes files it understands. For example, a text editor can open a plain-text note. The app and the note are different things: closing the app does not normally delete a saved note.",
      "Save writes your current work to storage. Save As, when available, lets you choose another name or location. Before closing a new note, find the app's Save command and check where the note will go. Menu names vary across computers. A notes app may save automatically instead; check its own status rather than assuming every app works the same way.",
      "A download copies information from another system to your device. An upload sends a copy from your device to another system. Downloaded files often appear in a Downloads folder, but the location can be changed. A file ending such as .txt or .pdf can suggest its type. A familiar name or ending alone does not prove a downloaded file is safe.",
      "For this course, keep a note for each lesson. Write what you expected, what happened and what you changed. Do not put real passwords, private customer information or company configuration files in practice notes. Your notes do not need technical language: 'The message arrived after I corrected the address' is useful."
    ],
    steps: ["Open a notes or text-editing app already on your device. You do not need to download a new one.", "Create a note titled My networking practice. Write: Today I learned the difference between hardware and software.", "Save the note or confirm that the app saved it automatically. Leave the note, open it again and check the sentence is still there."],
    question: "You wrote a note but cannot find it later. What should you check first?",
    answer: "Check the app you used, whether the note was saved, and its name or folder. Do not assume a note has disappeared just because another app does not show it."
  },
  {
    id: "web-and-networks",
    title: "A network, the Internet and Wi-Fi are not the same",
    outcome: "Explain how your device can connect to other devices.",
    paragraphs: [
      "A computer network is a group of connected devices that can exchange information. Two computers linked together can form a small network. A network can also include phones and printers. It does not have to reach the Internet. A computer can still run a local calculator without any network connection.",
      "The Internet connects many networks around the world. A web browser is an app, such as Firefox, Chrome, Edge or Safari, that can display web pages. A website is a collection of pages and related material. The address bar near the top of a browser is where you can enter a website address. A search engine helps find pages; it is not the same thing as the browser.",
      "Wi-Fi is one way your device joins a nearby network, using radio signals. An Ethernet cable is another common way. Being connected to Wi-Fi does not guarantee access to the Internet. The local connection might work while the wider connection has a problem. This distinction helps you ask a more useful question than 'Is everything broken?'.",
      "A switch connects devices within a local network. An access point helps wireless devices join that network. A router moves information between networks. An Internet service provider, often shortened to ISP, supplies an Internet connection. A home box sold as a Wi-Fi router may perform several of these jobs together. We will study the jobs separately before configuring them."
    ],
    steps: ["Name the browser you are using, if its name is visible. Find the address bar without changing any settings.", "Look at a device you own or have permission to use. Is its network connection wireless, cabled, or currently disconnected? Do not unplug a shared or work device.", "Imagine two office computers can still use their local printer, but neither can open an Internet website. Identify which part appears to be working and which part needs investigation."],
    question: "A phone shows a Wi-Fi connection, but a website will not open. Does that prove the phone's Wi-Fi is broken?",
    answer: "No. The local wireless connection may work. The website, name lookup or Internet connection may have a problem. One symptom is not enough to choose the cause."
  },
  {
    id: "addresses-and-messages",
    title: "Messages, addresses and simple rules",
    outcome: "Understand why a device needs a destination before sending information.",
    paragraphs: [
      "When devices exchange information, they need rules about how to send and understand it. A protocol is an agreed set of communication rules. Think about two people agreeing on a language and how to take turns. Computers use precise rules, not human conversations, but the comparison explains why both sides must understand the exchange.",
      "A large transfer is commonly carried in smaller units. You will hear words such as packet and frame. They describe units used at different stages of network communication; later lessons explain the difference. For now, picture a message with information about where it should go. Do not assume a single click always sends exactly one packet.",
      "An Internet Protocol address, shortened to IP address, helps identify a device's network connection. An example IPv4 address is 192.168.10.1. IPv4 is one version of the addressing system. Its four numbers, separated by dots, are each between 0 and 255. These are not decimal fractions. You will also meet IPv6, which writes addresses differently.",
      "In our first lab, a subnet is one local IP group. The mask 255.255.255.0 describes its boundary. /24 is another way to write that same boundary for IPv4. With this mask, 192.168.10.1 and 192.168.10.2 belong to the same local group. 192.168.20.2 belongs to a different group. This shortcut is specific to this mask; do not use it for every subnet. We teach the calculation later.",
      "A postal address is a helpful comparison, but an IP address is not a person's name or permanent identity. Addresses can change or be reused in separate networks. A default gateway is a device, usually a router, used to reach other networks when a more specific path is not available. Our first two-computer lab needs no gateway because both computers are in one local group."
    ],
    steps: ["Write PC1: 192.168.10.1 and PC2: 192.168.10.2 on paper. PC means personal computer; these are names for two practice computers.", "Write 255.255.255.0 beside both addresses. With this mask, compare the first three numbers. They match, so the addresses belong to the same local group.", "Change only PC2 on your paper to 192.168.20.2. The group no longer matches. Do not change your real phone or computer's address."],
    question: "In this example with mask 255.255.255.0, are 192.168.10.5 and 192.168.10.8 in the same local group?",
    answer: "Yes. The first three numbers match for this particular mask. The last numbers identify different connections in the group. A different mask can change how the boundary is calculated."
  },
  {
    id: "safe-lab",
    title: "Prepare a safe practice network",
    outcome: "Know where commands belong and how to get help before installing lab software.",
    paragraphs: [
      "A lab is a place to practice. In this course, it usually means a small pretend network running in software on your computer. GNS3 is the name of one lab program. It lets you place simulated devices on a workspace and connect them. A topology is simply a picture or description of those connections.",
      "VPCS means Virtual PC Simulator. It acts like a very small test computer inside GNS3. It is not a full desktop with a browser. The first lesson uses two VPCS devices and a built-in Ethernet switch. These do not need a Cisco software image. Later Cisco device labs may need separately licensed software; do not download it from unofficial image-sharing sites.",
      "A console is a text window where you give instructions to one device. A command is one such instruction. In a VPCS console, 'show ip' asks to see the current address settings. You type the command and press Enter. The displayed device name, such as PC1>, is a prompt showing which device is listening. Do not type that prompt as part of the command.",
      "Before installing GNS3, identify your computer's operating system and read the official installation guide for it. You may need help from the person who owns or manages the computer. Check current hardware requirements. Do not turn off security software, change office network settings, or install a program on a work or school computer without permission. If you have only a phone, begin with the explanations and paper exercises.",
      "Keep the practice network isolated: do not add a connection from GNS3 to your real home or work network. If a command fails, read its message, check which console is selected, and compare your typing with the lesson. Record the error and ask for help when needed. A failed attempt is a useful observation, not a reason to run unrelated commands."
    ],
    steps: ["Choose the official GNS3 installation guide for Windows, macOS or Linux from the links below. Read its requirements before downloading anything.", "When GNS3 is installed and starts successfully, follow its setup guide for the local server. In this context, a server is the program running the simulated devices; it can run on your own computer.", "Open the first course lesson when you are ready. It explains how to create a project, add the two test computers, connect them and type each command. You can read the worked example before building it."],
    question: "A lesson shows PC1> show ip. Which part do you type, and where?",
    answer: "Type only show ip in the PC1 VPCS console, then press Enter. PC1> is the device's prompt. It is not part of the command, and the command does not belong in your browser's address bar."
  }
];

export const ccnaFoundationQuiz = [
  { question: "Which item is software rather than hardware?", options: ["A calculator app", "A keyboard", "A screen", "A network cable"], correctIndex: 0, explanation: "An app is a program made of instructions. The other choices are physical objects, so they are hardware." },
  { question: "What does saving a new note normally do?", options: ["Stores the work so you can open it later", "Deletes the note", "Sends it to every device", "Changes your Internet connection"], correctIndex: 0, explanation: "Saving keeps the work in the app's chosen storage location. It does not automatically send the note or change a network." },
  { question: "Which statement about a network is correct?", options: ["It must include the whole Internet", "It can connect just a few local devices", "It only works with Wi-Fi", "It is the same thing as a web browser"], correctIndex: 1, explanation: "A network can be small and local. It may use cables, wireless links or both. A browser is an app, not the network itself." },
  { question: "What does an IP address help identify?", options: ["A person's permanent identity", "A device's network connection", "The price of a laptop", "The brand of a screen"], correctIndex: 1, explanation: "An IP address is used for network communication. It can change and is not a reliable permanent identity for a person." },
  { question: "Where should you type the first lab's VPCS commands?", options: ["Into a public website's search box", "Into your work router without permission", "Into the named VPCS console in the isolated lab", "Into a phone's contact list"], correctIndex: 2, explanation: "The lesson names the intended simulated device. Keeping commands in that isolated practice console avoids changing real equipment." }
];

export const ccnaFoundationSources = [
  { label: "Cisco Networking Academy course catalogue", url: "https://www.netacad.com/sites/default/files/course-catalog.pdf" },
  { label: "GNS3 Windows installation", url: "https://docs.gns3.com/docs/getting-started/installation/windows" },
  { label: "GNS3 macOS installation", url: "https://docs.gns3.com/docs/getting-started/installation/mac" },
  { label: "GNS3 Linux installation", url: "https://docs.gns3.com/docs/getting-started/installation/linux" },
  { label: "GNS3 local-server setup", url: "https://docs.gns3.com/docs/getting-started/setup-wizard-local-server" },
  { label: "GNS3 first network and VPCS commands", url: "https://docs.gns3.com/docs/getting-started/your-first-gns3-topology" }
];
