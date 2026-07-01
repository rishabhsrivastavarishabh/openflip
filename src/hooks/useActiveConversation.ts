// Tracks which conversation the current tab has open, so message push logic
// can suppress toast/system notifications when the user is actively viewing that chat.
let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null) {
  activeConversationId = id;
}

export function getActiveConversation(): string | null {
  return activeConversationId;
}

export function isDocumentVisible(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}
