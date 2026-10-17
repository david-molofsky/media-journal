export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  entryId?: string;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
}
