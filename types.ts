export type AppView =
  | 'home'
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
