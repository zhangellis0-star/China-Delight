// Text limits shared by the order forms and the checkout route. Kept short so the text fits the
// kitchen ticket, Sheet, and email.
export const customerFieldLimits = { name: 80, phone: 30, email: 254, notes: 500 } as const;
export const maxItemNotesLength = 300;
