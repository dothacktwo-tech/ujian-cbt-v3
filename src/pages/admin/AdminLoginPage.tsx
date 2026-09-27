import React from 'react';
import { CbtLoginPage } from '../../components/auth/CbtLoginPage';

interface AdminLoginPageProps {
  onSwitchToStudent: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSwitchToStudent }) => {
  return (
    <CbtLoginPage
      initialRole="admin"
      onSwitchRole={(newRole) => {
        if (newRole === 'siswa') {
          onSwitchToStudent();
        }
      }}
    />
  );
};
