
import { ConfigSection, SectionType } from '../types';
import { SECTION_METADATA } from '../constants';

export class CiscoConfigParser {
  public parse(configText: string): ConfigSection[] {
    const lines = configText.split('\n');
    
    // Fixed: Initialize sections record with explicit typing to avoid 'unknown' inference error
    const sections: Record<SectionType, string[]> = {} as Record<SectionType, string[]>;
    (Object.values(SectionType) as SectionType[]).forEach(type => {
      sections[type] = [];
    });

    let currentContext: SectionType = SectionType.OTHER;
    let block: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed === '!') {
        if (block.length > 0) {
          sections[currentContext].push(...block);
          block = [];
        }
        currentContext = SectionType.OTHER;
        continue;
      }

      // Context detection
      if (rawLine.startsWith('hostname ')) currentContext = SectionType.SYSTEM;
      else if (rawLine.startsWith('username ')) currentContext = SectionType.USERS;
      else if (rawLine.startsWith('aaa ')) currentContext = SectionType.AAA;
      else if (rawLine.startsWith('tacacs-server ') || rawLine.startsWith('tacacs server ')) currentContext = SectionType.TACACS;
      else if (rawLine.startsWith('radius-server ') || rawLine.startsWith('radius server ')) currentContext = SectionType.RADIUS;
      else if (rawLine.startsWith('vlan ')) currentContext = SectionType.VLANS;
      else if (rawLine.startsWith('interface ')) currentContext = SectionType.INTERFACES;
      else if (rawLine.startsWith('line vty ')) currentContext = SectionType.VTY;
      else if (rawLine.startsWith('line con ') || rawLine.startsWith('line aux ')) currentContext = SectionType.CONSOLE;
      else if (rawLine.startsWith('ip route ') || rawLine.startsWith('router ')) currentContext = SectionType.ROUTING;
      else if (rawLine.startsWith('access-list ') || rawLine.startsWith('ip access-list ')) currentContext = SectionType.ACLS;
      else if (rawLine.startsWith('spanning-tree ')) currentContext = SectionType.STP;
      else if (rawLine.startsWith('class-map ') || rawLine.startsWith('policy-map ') || rawLine.startsWith('mls qos')) currentContext = SectionType.QOS;
      else if (rawLine.startsWith('snmp-server ')) currentContext = SectionType.SNMP;
      else if (rawLine.startsWith('logging ')) currentContext = SectionType.LOGGING;
      else if (rawLine.startsWith('ntp ')) currentContext = SectionType.NTP;

      block.push(rawLine);
    }

    // Handle last block
    if (block.length > 0) {
      sections[currentContext].push(...block);
    }

    // Convert Record to Array and filter empty
    return (Object.keys(sections) as SectionType[])
      .filter(type => sections[type].length > 0)
      .map(type => ({
        id: type,
        type: type,
        name: SECTION_METADATA[type].name,
        priority: SECTION_METADATA[type].priority,
        commands: sections[type],
        // Fixed: Adding missing status property required by ConfigSection interface
        status: 'pending' as const
      }))
      .sort((a, b) => a.priority - b.priority);
  }
}
