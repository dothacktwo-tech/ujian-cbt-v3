export interface User {
  userId: string;
  role: 'admin' | 'student';
  username: string;
  name: string;
  classId?: string;
  className?: string;
  nis?: string;
  status?: string;
}

export interface ClassItem {
  id: string;
  nama_kelas: string;
  tingkat: string;
  tahun_ajaran: string;
  status: 'aktif' | 'nonaktif';
  student_count?: number;
  created_at: string;
  updated_at: string;
}

export interface StudentItem {
  id: string;
  nis: string;
  nama: string;
  username: string;
  class_id: string;
  nama_kelas?: string;
  status: 'aktif' | 'nonaktif';
  created_at: string;
  updated_at: string;
}

export interface QuestionBankItem {
  id: string;
  nama_bank: string;
  mata_pelajaran: string;
  kelas_id?: string | null;
  nama_kelas?: string;
  deskripsi: string;
  status: 'aktif' | 'nonaktif';
  total_questions?: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionItem {
  id: string;
  question_bank_id: string;
  pertanyaan: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e?: string;
  kategori?: string;
  jumlah_opsi?: number;
  jawaban_benar?: string; // Hidden on student exam taking
  bobot: number;
  created_at: string;
  updated_at: string;
}

export interface ExamItem {
  id: string;
  nama_ujian: string;
  mata_pelajaran: string;
  class_id: string;
  nama_kelas?: string;
  question_bank_id: string;
  nama_bank?: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  durasi_menit: number;
  token: string;
  shuffle_questions: number;
  shuffle_answers: number;
  tampilkan_nilai: number;
  status: 'draft' | 'aktif' | 'selesai';
  total_questions?: number;
  total_participants?: number;
  finished_participants?: number;
  ongoing_participants?: number;
  avg_score?: number;
  max_score?: number;
  min_score?: number;
  // Student view fields
  participant_status?: 'belum_mulai' | 'sedang_mengerjakan' | 'selesai';
  started_at?: string;
  submitted_at?: string;
  score?: number;
  created_at: string;
  updated_at: string;
}

export interface ExamParticipantResult {
  id: string;
  exam_id: string;
  student_id: string;
  nis: string;
  student_name: string;
  username: string;
  nama_kelas: string;
  started_at?: string;
  submitted_at?: string;
  status: 'belum_mulai' | 'sedang_mengerjakan' | 'selesai';
  score: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  last_heartbeat?: string;
  is_online?: boolean;
  current_question_index?: number;
  answered_count?: number;
  remaining_seconds?: number;
  updated_at: string;
}

export interface AppSettings {
  school_name: string;
  school_short_name?: string;
  school_description?: string;
  school_logo_url?: string;
  academic_year: string;
  school_logo?: string;
  default_shuffle_questions?: string;
  default_shuffle_answers?: string;
  default_show_score?: string;
  login_title?: string;
  login_subtitle?: string;
  login_description?: string;
  login_button_text?: string;
  login_illustration_url?: string;
  illustration_position?: 'center' | 'top' | 'bottom';
  illustration_size?: number;
  illustration_fit?: 'contain' | 'cover';
  primary_color?: string;
  button_color?: string;
  background_color?: string;
  login_image_type?: 'default_waving' | 'custom_url' | 'lucide_minimal';
  login_image_url?: string;
  login_bg_type?: 'default' | 'custom_bg' | 'dark_theme' | 'school_gradient';
  login_bg_url?: string;
  login_bg_overlay?: string;
  allow_student_print_result?: '1' | '0';
  card_title?: string;
  card_subtitle?: string;
  card_header_color?: string;
  card_layout_grid?: string;
  card_show_photo?: string;
  card_show_qr?: string;
  card_show_rules?: string;
  card_rules_text?: string;
  card_sign_location?: string;
  card_sign_title?: string;
  card_sign_name?: string;
  card_sign_nip?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  stats?: any;
  examsToday?: ExamItem[];
  recentActivity?: any[];
  isTimeUp?: boolean;
  serverTime?: string;
  pgVersion?: string;
  sql?: string;
  createdTables?: string[];
  errors?: string[];
  token?: string;
  user?: User;
}
