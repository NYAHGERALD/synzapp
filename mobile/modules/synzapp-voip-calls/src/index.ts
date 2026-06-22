import { requireOptionalNativeModule } from 'expo-modules-core';

export interface SynzappVoipCallRecord {
  callId: string;
  callerName: string;
  callerUid: string;
  chatType: 'DIRECT' | 'GROUP';
  contactId: string;
  createdAt: string;
  mode: 'voice' | 'video';
  participantUids: string[];
  tenantId: string;
  title: string;
}

export interface SynzappVoipCallEvent {
  call?: SynzappVoipCallRecord;
  callId?: string;
  nativeDisplayed?: boolean;
  type: 'answer' | 'end' | 'incoming';
}

export interface SynzappVoipCallsModule {
  addListener?: (
    eventName: 'onSynzappVoipCallEvent' | 'onSynzappVoipToken',
    listener: (event: SynzappVoipCallEvent | { token?: string }) => void
  ) => { remove: () => void };
  endCall?: (callId: string, reason?: string) => Promise<void>;
  getPendingEvents?: () => Promise<SynzappVoipCallEvent[]>;
  getVoipToken?: () => Promise<string | null>;
  isAvailable?: () => Promise<boolean>;
}

export default requireOptionalNativeModule<SynzappVoipCallsModule>('SynzappVoipCalls');
