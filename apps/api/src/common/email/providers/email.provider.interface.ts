export interface EmailEnvelope {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  /** Optional tenant context — providers may use it for tagging / multi-account routing. */
  tenantId?: string;
}

export interface EmailProvider {
  readonly name: 'console' | 'smtp';
  send(envelope: EmailEnvelope): Promise<{ providerMessageId?: string }>;
}
