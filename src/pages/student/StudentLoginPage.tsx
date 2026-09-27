import React from 'react';
import { CbtLoginPage } from '../../components/auth/CbtLoginPage';

interface StudentLoginPageProps {
  onSwitchToAdmin: () => void;
}

export const StudentLoginPage: React.FC<StudentLoginPageProps> = ({ onSwitchToAdmin }) => {
  return (
    <CbtLoginPage
      initialRole="siswa"
      onSwitchRole={(newRole) => {
        if (newRole === 'admin') {
          onSwitchToAdmin();
        }
      }}
    />
  );
};
