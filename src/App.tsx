import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { ToastContainer } from './components/ui/Toast';
import { Loading } from './components/ui/Loading';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ClassesPage } from './pages/admin/ClassesPage';
import { StudentsPage } from './pages/admin/StudentsPage';
import { QuestionBanksPage } from './pages/admin/QuestionBanksPage';
import { QuestionBankDetailPage } from './pages/admin/QuestionBankDetailPage';
import { ExamsPage } from './pages/admin/ExamsPage';
import { ExamDetailPage } from './pages/admin/ExamDetailPage';
import { StudentReportsPage } from './pages/admin/StudentReportsPage';
import { ExamCardsPage } from './pages/admin/ExamCardsPage';
import { SettingsPage } from './pages/admin/SettingsPage';

// Student Pages
import { StudentLoginPage } from './pages/student/StudentLoginPage';
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { StudentExamRunnerPage } from './pages/student/StudentExamRunnerPage';
import { StudentExamResultPage } from './pages/student/StudentExamResultPage';

function AppContent() {
  const { user, loading } = useAuth();

  // Navigation State
  const [adminTab, setAdminTab] = useState<string>('dashboard');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  // Student Navigation State
  const [studentView, setStudentView] = useState<'dashboard' | 'exam' | 'result'>('dashboard');
  const [activeStudentExamId, setActiveStudentExamId] = useState<string | null>(null);

  // Login view toggle (when unauthenticated: 'student' or 'admin')
  const [loginRole, setLoginRole] = useState<'student' | 'admin'>('student');

  if (loading) {
    return <Loading message="Menghubungkan ke Server CBT..." fullHeight />;
  }

  // If user is not authenticated:
  if (!user) {
    if (loginRole === 'admin') {
      return <AdminLoginPage onSwitchToStudent={() => setLoginRole('student')} />;
    }
    return <StudentLoginPage onSwitchToAdmin={() => setLoginRole('admin')} />;
  }

  // ==========================================
  // ROLE 1: ADMINISTRATOR
  // ==========================================
  if (user.role === 'admin') {
    const handleAdminNavigate = (tab: string, paramId?: string) => {
      if (tab === 'question-bank-detail' && paramId) {
        setSelectedBankId(paramId);
        setAdminTab('question-bank-detail');
      } else if (tab === 'exam-detail' && paramId) {
        setSelectedExamId(paramId);
        setAdminTab('exam-detail');
      } else {
        setSelectedBankId(null);
        setSelectedExamId(null);
        setAdminTab(tab);
      }
    };

    return (
      <AdminLayout currentTab={adminTab} onTabChange={handleAdminNavigate}>
        {adminTab === 'dashboard' && <DashboardPage onNavigate={handleAdminNavigate} />}
        {adminTab === 'classes' && <ClassesPage />}
        {adminTab === 'students' && <StudentsPage />}
        {adminTab === 'question-banks' && (
          <QuestionBanksPage
            onSelectBank={(id) => {
              setSelectedBankId(id);
              setAdminTab('question-bank-detail');
            }}
            onNavigateToExams={() => setAdminTab('exams')}
          />
        )}
        {adminTab === 'question-bank-detail' && selectedBankId && (
          <QuestionBankDetailPage
            bankId={selectedBankId}
            onBack={() => setAdminTab('question-banks')}
          />
        )}
        {adminTab === 'exams' && (
          <ExamsPage
            onSelectExam={(id) => {
              setSelectedExamId(id);
              setAdminTab('exam-detail');
            }}
          />
        )}
        {adminTab === 'exam-detail' && selectedExamId && (
          <ExamDetailPage examId={selectedExamId} onBack={() => setAdminTab('exams')} />
        )}
        {adminTab === 'student-reports' && <StudentReportsPage />}
        {adminTab === 'exam-cards' && <ExamCardsPage />}
        {adminTab === 'settings' && <SettingsPage />}
      </AdminLayout>
    );
  }

  // ==========================================
  // ROLE 2: SISWA (STUDENT)
  // ==========================================
  if (user.role === 'student') {
    if (studentView === 'exam' && activeStudentExamId) {
      return (
        <StudentExamRunnerPage
          examId={activeStudentExamId}
          onFinishExam={(examId) => {
            setActiveStudentExamId(examId);
            setStudentView('result');
          }}
          onExit={() => {
            setActiveStudentExamId(null);
            setStudentView('dashboard');
          }}
        />
      );
    }

    if (studentView === 'result' && activeStudentExamId) {
      return (
        <StudentLayout>
          <StudentExamResultPage
            examId={activeStudentExamId}
            onBackToDashboard={() => {
              setActiveStudentExamId(null);
              setStudentView('dashboard');
            }}
          />
        </StudentLayout>
      );
    }

    return (
      <StudentLayout>
        <StudentDashboardPage
          onStartExam={(examId) => {
            setActiveStudentExamId(examId);
            setStudentView('exam');
          }}
          onViewResult={(examId) => {
            setActiveStudentExamId(examId);
            setStudentView('result');
          }}
        />
      </StudentLayout>
    );
  }

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <ToastContainer />
    </AuthProvider>
  );
}
