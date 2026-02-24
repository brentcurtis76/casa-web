/**
 * Leadership Module — TypeScript Type Definitions
 *
 * Handwritten types mirroring the 8 church_leadership_* database tables.
 * Independent of auto-generated Supabase types.
 *
 * Convention:
 *   Row    — full row as returned by SELECT (all columns present)
 *   Insert — for INSERT: server-generated fields (id, created_at, updated_at) optional
 *   Update — for UPDATE: all fields optional (Partial<Insert>)
 *
 * IMPORTANT naming conventions (from DB agent):
 *   - Column is `meeting_date` (DATE), NOT `date`
 *   - Commitment uses `assignee_id` NOT `assigned_to`
 *   - Both `assignee_id` and `assigned_by` exist on commitments
 *   - Table for participants is `church_leadership_meeting_participants`
 */

// =====================================================
// CHECK-constraint union types
// =====================================================

/** church_leadership_meeting_types.recurrence CHECK */
export type MeetingRecurrence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'on_demand';

/** church_leadership_meeting_type_members.role CHECK */
export type MeetingTypeMemberRole = 'chair' | 'secretary' | 'member';

/** church_leadership_meetings.status CHECK */
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** church_leadership_recordings.transcription_status CHECK */
export type TranscriptionStatus = 'none' | 'pending' | 'processing' | 'completed' | 'failed';

/** church_leadership_commitments.priority CHECK */
export type CommitmentPriority = 'low' | 'medium' | 'high' | 'urgent';

/** church_leadership_commitments.status CHECK */
export type CommitmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// =====================================================
// EXTRACTED ACTION ITEM (from AI transcription)
// =====================================================

export interface ActionItem {
  title: string;
  description?: string;
  assignee_hint?: string;
  due_date_hint?: string;
  priority?: CommitmentPriority;
}

// =====================================================
// BASIC USER (for joined queries)
// =====================================================

export interface UserBasic {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
}

// =====================================================
// ROW INTERFACES (full rows from SELECT)
// =====================================================

/** church_leadership_meeting_types */
export interface MeetingTypeRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  color: string | null;
  recurrence: MeetingRecurrence;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** church_leadership_meeting_type_members */
export interface MeetingTypeMemberRow {
  id: string;
  meeting_type_id: string;
  user_id: string;
  role: MeetingTypeMemberRole;
  joined_at: string;
}

/** church_leadership_meetings */
export interface MeetingRow {
  id: string;
  meeting_type_id: string;
  title: string;
  meeting_date: string;   // DATE column — ISO date string
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  status: MeetingStatus;
  agenda_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** church_leadership_meeting_participants */
export interface MeetingParticipantRow {
  id: string;
  meeting_id: string;
  user_id: string;
  attended: boolean;
  invited_at: string;
  responded_at: string | null;
}

/** church_leadership_recordings */
export interface RecordingRow {
  id: string;
  meeting_id: string;
  filename: string;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  transcription_status: TranscriptionStatus;
  transcript_text: string | null;
  transcript_summary: string | null;
  transcription_action_items: ActionItem[];
  transcribed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** church_leadership_notes */
export interface NoteRow {
  id: string;
  meeting_id: string;
  content: string;
  is_official: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

/** church_leadership_commitments */
export interface CommitmentRow {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;       // NOT `assigned_to`
  assigned_by: string | null;       // separate FK
  due_date: string | null;
  priority: CommitmentPriority;
  status: CommitmentStatus;
  source_recording_id: string | null;  // AI-extracted commitment link
  follow_up_meeting_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** church_leadership_documents */
export interface DocumentRow {
  id: string;
  meeting_id: string;
  filename: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// =====================================================
// INSERT TYPES (for INSERT operations)
// =====================================================

export type MeetingTypeInsert = Omit<MeetingTypeRow, 'id' | 'created_at' | 'updated_at'>;
export type MeetingTypeMemberInsert = Omit<MeetingTypeMemberRow, 'id' | 'joined_at'>;
export type MeetingInsert = Omit<MeetingRow, 'id' | 'created_at' | 'updated_at'>;
export type MeetingParticipantInsert = Omit<MeetingParticipantRow, 'id' | 'invited_at' | 'responded_at'> & {
  attended?: boolean;
};
export type RecordingInsert = Omit<RecordingRow, 'id' | 'created_at' | 'updated_at'>;
export type NoteInsert = Omit<NoteRow, 'id' | 'created_at' | 'updated_at'>;
export type CommitmentInsert = Omit<CommitmentRow, 'id' | 'created_at' | 'updated_at'>;
export type DocumentInsert = Omit<DocumentRow, 'id' | 'created_at'>;

// =====================================================
// UPDATE TYPES (for UPDATE operations)
// =====================================================

export type MeetingTypeUpdate = Partial<MeetingTypeInsert>;
export type MeetingUpdate = Partial<MeetingInsert>;
export type RecordingUpdate = Partial<RecordingInsert>;
export type NoteUpdate = Partial<NoteInsert>;
export type CommitmentUpdate = Partial<CommitmentInsert>;

// =====================================================
// COMPOSITE TYPES (for joined queries)
// =====================================================

/** Meeting with meeting_type joined */
export interface MeetingWithType extends MeetingRow {
  meeting_type: MeetingTypeRow | null;
}

/** Meeting type with its members */
export interface MeetingTypeWithMembers extends MeetingTypeRow {
  members: (MeetingTypeMemberRow & { user: UserBasic })[];
}

/** Commitment with user details */
export interface CommitmentWithUsers extends CommitmentRow {
  assignee: UserBasic | null;
  assigned_by_user: UserBasic | null;
}

// =====================================================
// FILTER TYPES (for query filters)
// =====================================================

export interface MeetingFilters {
  meeting_type_id?: string;
  status?: MeetingStatus;
  from_date?: string;
  to_date?: string;
  search?: string;
}

export interface CommitmentFilters {
  meeting_id?: string;
  assignee_id?: string;
  status?: CommitmentStatus;
  priority?: CommitmentPriority;
  overdue_only?: boolean;
  meeting_type_id?: string;
  search?: string;
}
