
export enum SectionType {
  SYSTEM = 'SYSTEM',
  USERS = 'USERS',
  AAA = 'AAA',
  TACACS = 'TACACS',
  RADIUS = 'RADIUS',
  VLANS = 'VLANS',
  INTERFACES = 'INTERFACES',
  VTY = 'VTY',
  CONSOLE = 'CONSOLE',
  ROUTING = 'ROUTING',
  ACLS = 'ACLS',
  STP = 'STP',
  QOS = 'QOS',
  SNMP = 'SNMP',
  LOGGING = 'LOGGING',
  NTP = 'NTP',
  OTHER = 'OTHER',
}

export type AIProvider = 'google' | 'ollama' | 'mistral';

export interface ConfigSection {
  id: string;
  type: SectionType;
  name: string;
  priority: number;
  commands: string[];
  status: 'pending' | 'converting' | 'success' | 'warning' | 'error';
  convertedCommands?: string[];
  modifiedCommands?: Set<number>; // Indices of commands added/modified via advisory fixes
}

export interface SavedSession {
  id: string;
  name: string;
  timestamp: string;
  sourceConfig: string;
  targetConfig: string;
  targetSpec: TargetSpec;
}

export interface TargetSpec {
  sourceModel: string;
  sourceIOS: string;
  model: string;
  targetIOS: string;
}

export interface AppSettings {
  activeProvider: AIProvider;
  activeModel: string;
  ollamaEndpoint: string;
  mistralApiKey: string;
  mistralEndpoint: string;
  mistralModels: string[]; // Dynamically fetched models
  autoExecute: boolean;
  deepScan: boolean;
  terminalTheme: 'dark' | 'matrix';
}

export interface LogEntry {
  timestamp: string;
  type: 'SUCCESS' | 'WARNING' | 'INFO' | 'ERROR';
  message: string;
}

export interface DeploymentStep {
  order: number;
  phase: string;
  task: string;
  verificationCmd: string;
  expectedResult: string;
}

export interface ConversionWarning {
  severity: string;
  message: string;
  action?: string;
  instructions?: string;
  suggestedConfig?: string;
}

export interface ConversionResult {
  sectionId: string;
  status: string;
  convertedCommands: string[];
  warnings: ConversionWarning[];
  notes: string[];
  confidence: string;
  deploymentSteps?: DeploymentStep[];
}
