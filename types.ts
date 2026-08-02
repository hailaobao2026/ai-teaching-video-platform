export type AppView =
  | 'home'
  | 'assistant'
  | 'classroom'
  | 'rural-pilot'
  | 'create'
  | 'jobs'
  | 'courses'
  | 'my-courses'
  | 'teacher-review'
  | 'admin'
  | 'admin-knowledge'
  | 'profile'
  | 'login';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type PublishStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type OutputProfile =
  | 'image_generation'
  | 'infographic_only'
  | 'teaching_video_full'
  | 'package_all'
  | 'tech_article_diagram'
  | 'article_explainer_video'
  | 'short_video_cover';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  status?: string;
  teacherSubjects?: string[];
  grade?: string | null;
}

export interface RuralPilotRecord {
  id: string;
  createdBy: string;
  schoolName: string;
  region: string;
  teacherName: string;
  className?: string | null;
  gradeCode?: string | null;
  subjectCode?: string | null;
  textbookEdition?: string | null;
  topic: string;
  courseId?: string | null;
  jobId?: string | null;
  studentCount?: number | null;
  prepBeforeMinutes?: number | null;
  prepAfterMinutes?: number | null;
  preQuizTotal?: number | null;
  preQuizCorrect?: number | null;
  postQuizTotal?: number | null;
  postQuizCorrect?: number | null;
  teacherAccuracyScore?: number | null;
  teacherUsefulnessScore?: number | null;
  teacherFeedback?: string | null;
  networkMode: 'online' | 'unstable' | 'offline';
  offlineDownloaded: boolean;
  offlinePlayed: boolean;
  playbackDurationSec?: number | null;
  playbackInterruptionCount: number;
  incidentNote?: string | null;
  consentConfirmed: boolean;
  status: 'draft' | 'submitted' | 'verified';
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  verifiedAt?: string | null;
}

export interface RuralPilotSummary {
  hasData: boolean;
  recordCount: number;
  submittedRecordCount: number;
  prep: { sampleCount: number; beforeAvgMinutes: number | null; afterAvgMinutes: number | null; savedAvgMinutes: number | null; savedRate: number | null };
  quiz: { sampleCount: number; preAccuracy: number | null; postAccuracy: number | null; improvement: number | null };
  teacher: { sampleCount: number; accuracyAvg: number | null; usefulnessAvg: number | null };
  network: { modeCounts: Record<'online' | 'unstable' | 'offline', number>; offlinePlayedCount: number; offlinePlaybackRate: number | null };
}
export interface CreateJobRequest {
  subject: string;
  grade: string;
  chapter: string;
  topic: string;
  learningGoals?: string[];
  styleNotes?: string;
  outputProfile?: OutputProfile;
  autoCreateCourse?: boolean;
  article?: string;
  prompt?: string;
  style?: string;
  imageProvider?: string;
  referenceImages?: string[];
  textbookEdition?: string;
  classroomScenario?: 'lesson-prep' | 'in-class' | 'review' | 'mixed-grade';
  lowBandwidth?: boolean;
}

export interface AssistantSource {
  id: string;
  topic: string;
  chapter: string;
  summary: string;
  subjectCode: string;
  gradeCode: string;
}

export interface AssistantResponse {
  answer: string;
  mode: 'llm' | 'local';
  model?: string | null;
  sources: AssistantSource[];
  suggestedQuestions: string[];
}

export interface GenerationJob {
  id: string;
  status: JobStatus;
  progress: number;
  currentStage: string;
  topic: string;
  subject: string;
  grade: string;
  chapter: string;
  outputProfile: OutputProfile;
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
  assets?: MediaAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id?: string;
  job_id?: string;
  course_id?: string;
  asset_type?: string;
  assetType?: string;
  path?: string;
  url?: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface CourseItem {
  id: string;
  title: string;
  topic: string;
  subject: string;
  grade: string;
  chapter: string;
  summary: string;
  publishStatus: PublishStatus;
  visibility: 'private' | 'public';
  coverUrl?: string;
  videoUrl?: string;
  durationSec?: number;
  viewCount: number;
  authorName: string;
  createdAt: string;
}

export interface AdminStats {
  users: number;
  jobs: number;
  runningJobs: number;
  courses: number;
  pendingReviews: number;
}
