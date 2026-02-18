
import { SectionType } from './types';

export const SECTION_METADATA: Record<SectionType, { name: string; priority: number }> = {
  [SectionType.SYSTEM]: { name: 'System & Hostname', priority: 1 },
  [SectionType.USERS]: { name: 'Local Users', priority: 2 },
  [SectionType.AAA]: { name: 'AAA Configuration', priority: 3 },
  [SectionType.TACACS]: { name: 'TACACS+ Settings', priority: 4 },
  [SectionType.RADIUS]: { name: 'RADIUS Settings', priority: 5 },
  [SectionType.VLANS]: { name: 'VLAN Database', priority: 6 },
  [SectionType.INTERFACES]: { name: 'Interface Config', priority: 7 },
  [SectionType.VTY]: { name: 'VTY / Remote Access', priority: 8 },
  [SectionType.CONSOLE]: { name: 'Console / Line Access', priority: 9 },
  [SectionType.ROUTING]: { name: 'Static & Dynamic Routing', priority: 10 },
  [SectionType.ACLS]: { name: 'Access Control Lists', priority: 11 },
  [SectionType.STP]: { name: 'Spanning Tree', priority: 12 },
  [SectionType.QOS]: { name: 'Quality of Service', priority: 13 },
  [SectionType.SNMP]: { name: 'SNMP Management', priority: 14 },
  [SectionType.LOGGING]: { name: 'Syslog & Monitoring', priority: 15 },
  [SectionType.NTP]: { name: 'NTP Time Sync', priority: 16 },
  [SectionType.OTHER]: { name: 'Miscellaneous Global', priority: 99 },
};

export const COMMON_MODELS = [
  'Catalyst 9200',
  'Catalyst 9300',
  'Catalyst 9500',
  'Nexus 9300',
  'Nexus 9500',
  'Catalyst 1000'
];

export const IOS_VERSIONS = [
  'IOS-XE 17.3.1',
  'IOS-XE 17.6.1',
  'IOS-XE 17.9.1',
  'IOS-XE 17.12.1',
  'NX-OS 9.3.5',
  'NX-OS 10.2.1'
];
