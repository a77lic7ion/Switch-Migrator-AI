# Cisco Switch Migrator AI (Enterprise v2.4.0) 🚀

## Introduction
The **Cisco Switch Migrator AI** is a professional-grade engineering workbench designed to automate the transition from legacy Cisco Catalyst environments (Cisco IOS) to modern enterprise architectures like **Cisco IOS-XE** and **Nexus NX-OS**. 

Bridged syntax is just the beginning—this platform handles **dependencies, hierarchy, and deprecation** natively. By combining deterministic parsing with the reasoning capabilities of Google Gemini, this tool re-architects configuration files into copy-paste-ready, deployment-safe CLI scripts.

---

## 🛠️ Key Capabilities

- **Intelligent Platform Detection**: Paste any config snippet, and the AI will attempt to identify the hardware model and IOS version automatically to tailor the conversion.
- **Context-Aware Conversion**: Understands the subtle differences between global config mode and various sub-interface modes (VLAN, Router, Port-Channel).
- **Temporal Dependency Ordering**: Automatically ensures critical system settings (NTP, AAA) precede dependent services (Logging, Groups).
- **Hierarchy Validation**: Every output block is wrapped in necessary `!` or `exit` markers, ensuring scripts don't break during batch CLI paste.
- **Corrective Advisory System**: Flags deprecated commands and provides one-click corrective syntax injection.

---

## 🖥️ UI Element Encyclopedia

### 1. Legacy Source Input (Left Panel)
Paste your raw legacy Cisco configuration here. 
- **Auto-Parsing**: The "Logic Blocks" sidebar populates instantly.
- **Auto-Detection**: The AI immediately scans for 'version' or model headers to populate metadata fields automatically.

### 2. Bridged Syntax Output (Right Panel)
The primary workspace for modern configuration generation.
- **Copy-Paste Ready**: Structured to be pasted directly at the `config t` prompt.
- **Smart Highlighting**: Any line added via the **Advisory Panel** is highlighted in **Emerald Green**, marking it as an AI-augmented fix.

### 3. Navigation Rail (Left Sidebar)
- **Activity (Pulse)**: Tracks live conversion status and engine telemetry.
- **Sessions (Box)**: Project Manager for archiving and restoring migration workspaces.
- **History (Clock)**: Timeline of logs and review passes.
- **Settings (Gear)**: AI Engine configuration (Flash for speed, Pro for complexity).

### 4. Logic Blocks Navigator
Collapsible panel for jumping between context domains (VLANs, AAA, STP, etc.). Icons provide status summaries at a glance even when collapsed.

### 5. Deployment Plan Tab
Provides a step-by-step checklist for on-site technicians. Includes **Verification Commands** for every phase to ensure the device is in the correct state before proceeding.

### 6. Advisory & Analysis Tab
Identifies legacy risks and deprecated syntax. Provides one-click "Append to Config" functionality to fix identified issues with modern equivalents.

### 7. Terminal Window Tab
A real-time "stream" of the conversion process, showing the AI's internal reasoning and CLI generation progress.

### 8. Difference Window Tab
Side-by-side view highlighting what has been changed, removed, or upgraded between the legacy and modern configurations.

### 9. Preferences (Settings)
Allows for deep environment scanning, model selection, and automated job behavior toggles.

---

## 🚀 Pro-Tip for Technicians
Utilize the **Deployment Plan** to verify the management plane (VTY/SSH) immediately after the "Management Access" phase. This prevents cutover lockouts before applying high-density interface and routing configs!